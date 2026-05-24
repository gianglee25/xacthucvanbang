import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Certificate } from "@/lib/db/models/Certificate";
import { DIPLOMA_STATUS } from "@/utils/constants";
import { executeTransaction } from "@/lib/fabric/fabricService";
import crypto from "crypto";

const CONCURRENCY_LIMIT = 5;

// Helper chuẩn hóa dữ liệu
export function normalizeGrade(raw: string): string {
  const norm = String(raw || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/\s+/g, "");
  const map: Record<string, string> = { "xuatsac": "Xuất sắc", "gioi": "Giỏi", "kha": "Khá", "trungbinhkha": "Trung bình khá", "trungbinh": "Trung bình" };
  return map[norm] || "Trung bình";
}

export function normalizeGpa(raw: any): string {
  const n = Number(raw);
  return !isNaN(n) && n >= 0 && n <= 4 ? n.toFixed(2) : "2.00";
}

async function processOne(row: any): Promise<{ ok: true } | { ok: false; reason: string }> {
  const mssv     = String(row.mssv || "").trim();
  const fullName = String(row.fullName || "").trim();
  const soHieu   = String(row.soHieu || "").trim();
  const soVaoSo  = String(row.soVaoSo || "").trim();
  const className= String(row.className || "").trim();
  const namTN    = String(row.namTotNghiep || "").trim();
  
  // 1. Kiểm tra trùng lặp
  const existing = await Certificate.findOne({ $or: [{ soHieu }, { soVaoSo }] }).lean();
  if (existing) return { ok: false, reason: `Văn bằng số ${soHieu} đã tồn tại.` };

  const certUuid    = crypto.randomUUID();
  const currentDate = new Date().toISOString().split("T")[0];
  const gradeFinal  = normalizeGrade(row.grade);
  const gpaFinal    = normalizeGpa(row.gpa);

  // 2. Ghi lên blockchain (Đã cập nhật đủ 11 tham số)
  let finalTxId: string;
  let blockchainHash: string;

  try {
    const response = await executeTransaction(
      "submit",
      "IssueCertificate",
      certUuid, mssv, fullName, String(row.major || ""),
      gpaFinal, gradeFinal, currentDate,
      soHieu, soVaoSo, className, namTN
    );

    const chaincodeResult = JSON.parse(response.payload || "{}");
    finalTxId      = response.txId || chaincodeResult.txId;
    blockchainHash = chaincodeResult.hash;

    if (!finalTxId) throw new Error("Blockchain không phản hồi TxID hợp lệ.");
  } catch (err: any) {
    return { ok: false, reason: `Blockchain lỗi: ${err.message}` };
  }

  // 3. Ghi vào MongoDB (Sử dụng tên trường đồng bộ với Schema mới)
  try {
    await Certificate.create({
      uuid: certUuid,
      certHash: blockchainHash,
      txId: finalTxId,
      status: DIPLOMA_STATUS.ON_CHAIN,
      mssv,
      fullName,
      major: row.major,
      gpa: Number(gpaFinal),
      grade: gradeFinal,
      issueDate: currentDate,
      soHieu,
      soVaoSo,
      className,
      namTotNghiep: Number(namTN)
    });
  } catch (err: any) {
    return { ok: false, reason: `Lỗi lưu Database: ${err.message}` };
  }

  return { ok: true };
}

async function runConcurrent<T>(items: T[], fn: (item: T) => Promise<any>, limit: number): Promise<any[]> {
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
    const { certificatesList } = await req.json();

    if (!Array.isArray(certificatesList)) return NextResponse.json({ success: false }, { status: 400 });

    const rawResults = await runConcurrent(certificatesList, processOne, CONCURRENCY_LIMIT);
    
    return NextResponse.json({
      success: true,
      data: {
        successCount: rawResults.filter(r => r.ok).length,
        failedCount: rawResults.filter(r => !r.ok).length,
        errors: rawResults.filter(r => !r.ok).map(r => r.reason)
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}