import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Certificate } from "@/lib/db/models/Certificate";
import { DIPLOMA_STATUS } from "@/utils/constants";
import { executeTransaction } from "@/lib/fabric/fabricService";
import crypto from "crypto";

const CONCURRENCY_LIMIT = 5;

// ─── Helper dùng chung cho cả import và verify ────────────────────────────────

/** Map xếp loại về dạng chuẩn tiếng Việt có dấu */
const GRADE_MAP: Record<string, string> = {
  "xuatsac":      "Xuất sắc",
  "gioi":         "Giỏi",
  "kha":          "Khá",
  "trungbinhkha": "Trung bình khá",
  "trungbinh":    "Trung bình",
};

export function normalizeGrade(raw: string): string {
  const norm = String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, "");
  return GRADE_MAP[norm] || "Trung bình";
}

export function normalizeGpa(raw: string | number | undefined | null): string {
  const s = String(raw ?? "").trim();
  const n = Number(s);
  return s && !isNaN(n) && n >= 0 && n <= 4 ? n.toFixed(2) : "2.00";
}

// ─── Xử lý từng bản ghi ──────────────────────────────────────────────────────

async function processOne(row: any): Promise<{ ok: true } | { ok: false; reason: string }> {
  const mssv     = String(row.mssv     || "").trim();
  const fullName = String(row.fullName || "").trim();
  const soHieu   = String(row.soHieu   || "").trim();
  const soVaoSo  = String(row.soVaoSo  || "").trim();

  // 1. Kiểm tra trùng lặp
  const orConditions: any[] = [];
  if (mssv && soHieu) orConditions.push({ mssv, certNo: soHieu });
  if (soVaoSo)        orConditions.push({ regNo: soVaoSo });

  if (orConditions.length > 0) {
    const existing = await Certificate.findOne({ $or: orConditions }).lean();
    if (existing) {
      return {
        ok: false,
        reason: `MSSV ${mssv || "(trống)"} — ${fullName}: Văn bằng đã tồn tại (certNo hoặc regNo trùng).`,
      };
    }
  }

  const certUuid    = crypto.randomUUID();
  const currentDate = new Date().toISOString().split("T")[0];

  // Chuẩn hoá grade và GPA — dùng cùng giá trị cho cả blockchain lẫn MongoDB
  const gradeFinal = normalizeGrade(row.grade);
  const gpaFinal   = normalizeGpa(row.gpa);
  const gpaNumber  = Number(gpaFinal); // lưu vào DB dạng số

  // 2. Ghi lên blockchain
  let finalTxId: string;
  let blockchainHash: string;

  try {
    const response = await executeTransaction(
      "submit",
      "IssueCertificate",
      certUuid,
      mssv       || "KĐ",
      fullName   || "Ẩn danh",
      String(row.major || "Không xác định"),
      gpaFinal,   // chuỗi "2.50" đã chuẩn hoá
      gradeFinal, // "Khá" / "Giỏi" ... đã chuẩn hoá
      currentDate
    );

    const chaincodeResult = JSON.parse(response.payload || "{}");
    finalTxId      = response.txId || chaincodeResult.txId;
    blockchainHash = chaincodeResult.hash;

    if (!finalTxId || !blockchainHash) {
      throw new Error("Blockchain không phản hồi mã băm hợp lệ.");
    }
  } catch (err: any) {
    return { ok: false, reason: `MSSV ${mssv || "(trống)"}: Blockchain lỗi — ${err.message}` };
  }

  // 3. Ghi vào MongoDB — lưu gradeFinal và gpaNumber đã chuẩn hoá
  try {
    await Certificate.create({
      uuid:          certUuid,
      certHash:      blockchainHash,
      txId:          finalTxId,
      status:        DIPLOMA_STATUS.ON_CHAIN,

      mssv:          mssv          || undefined,
      fullName,
      dob:           String(row.dob          || "").trim() || undefined,
      pob:           String(row.pob          || "").trim() || undefined,
      gender:        String(row.gender       || "").trim() || undefined,
      nation:        String(row.nation       || "").trim() || undefined,
      nationality:   String(row.nationality  || "").trim() || "Việt Nam",
      class:         String(row.className    || "").trim() || undefined,
      khuaHoc:       String(row.khuaHoc      || "").trim() || undefined,
      major:         String(row.major        || "").trim() || undefined,

      // Lưu giá trị ĐÃ CHUẨN HOÁ — khớp với những gì đã ghi lên blockchain
      grade:         gradeFinal,
      gpa:           gpaNumber,

      namTotNghiep:  String(row.namTotNghiep || "").trim() || undefined,
      regNo:         soVaoSo || undefined,
      certNo:        soHieu  || undefined,
      decisionNo:    String(row.decisionNo   || "").trim() || undefined,
      issueDate:     String(row.decisionDate || "").trim() || currentDate,
    });
  } catch (err: any) {
    console.error(`[CRITICAL] Blockchain OK nhưng MongoDB thất bại cho certUuid=${certUuid}:`, err.message);
    return {
      ok: false,
      reason: `MSSV ${mssv || "(trống)"}: Đã ghi blockchain (txId=${finalTxId}) nhưng lưu DB thất bại — ${err.message}`,
    };
  }

  return { ok: true };
}

async function runConcurrent<T>(
  items: T[],
  fn: (item: T) => Promise<any>,
  limit: number
): Promise<any[]> {
  const results: any[] = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const { certificatesList } = body;

    if (!certificatesList || !Array.isArray(certificatesList) || certificatesList.length === 0) {
      return NextResponse.json({ success: false, error: "Dữ liệu bị rỗng!" }, { status: 400 });
    }
    if (certificatesList.length > 500) {
      return NextResponse.json(
        { success: false, error: "Vượt quá giới hạn 500 bản ghi mỗi lần import. Hãy chia nhỏ file." },
        { status: 400 }
      );
    }

    const rawResults = await runConcurrent(certificatesList, processOne, CONCURRENCY_LIMIT);
    const successCount = rawResults.filter(r => r.ok).length;
    const failedCount  = rawResults.filter(r => !r.ok).length;
    const errors       = rawResults.filter(r => !r.ok).map(r => r.reason);

    return NextResponse.json({
      success: true,
      message: "Quá trình import hoàn tất.",
      data: { successCount, failedCount, errors },
    });
  } catch (error: any) {
    console.error("[IMPORT API]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}