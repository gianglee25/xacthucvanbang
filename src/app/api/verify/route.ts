import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Certificate } from "@/lib/db/models/Certificate";
import crypto from "crypto";
import { executeTransaction } from "@/lib/fabric/fabricService";

const GRADE_MAP: Record<string, string> = {
  "xuatsac":      "Xuất sắc",
  "gioi":         "Giỏi",
  "kha":          "Khá",
  "trungbinhkha": "Trung bình khá",
  "trungbinh":    "Trung bình",
};

function normalizeGrade(raw: string): string {
  const norm = String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, "");
  return GRADE_MAP[norm] || "Trung bình";
}

function normalizeGpa(raw: string | number | undefined | null): string {
  const s = String(raw ?? "").trim();
  const n = Number(s);
  return s && !isNaN(n) && n >= 0 && n <= 4 ? n.toFixed(2) : "2.00";
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();

    let targetUuid: string | undefined;
    let targetHash: string | undefined;

    if (body.uuid) {
      targetUuid = body.uuid;
    } else if (body.certHash) {
      targetHash = body.certHash;
    } else if (body.proofString) {
      try {
        const parsed = JSON.parse(body.proofString);
        targetUuid = parsed.certUUID || parsed.uuid;
        targetHash = parsed.certHash;
      } catch {
        return NextResponse.json(
          { success: false, error: "Định dạng minh chứng không hợp lệ." },
          { status: 400 }
        );
      }
    }

    if (!targetUuid && !targetHash) {
      return NextResponse.json(
        { success: false, error: "Vui lòng cung cấp UUID hoặc Hash của văn bằng!" },
        { status: 400 }
      );
    }

    const query = targetUuid ? { uuid: targetUuid } : { certHash: targetHash };
    const certLocal = await Certificate.findOne(query).lean() as any;

    if (!certLocal) {
      return NextResponse.json({
        success: false,
        error: "Văn bằng không tồn tại trong cơ sở dữ liệu hệ thống!",
      });
    }

    let blockchainResult: any;
    try {
      const response = await executeTransaction("evaluate", "QueryCertificate", certLocal.uuid);
      blockchainResult = typeof response.result === "string" ? JSON.parse(response.result) : response.result;

      if (!blockchainResult?.certHash) {
        throw new Error("Dữ liệu trên Blockchain không hợp lệ.");
      }
    } catch (bcError: any) {
      return NextResponse.json({
        success: false,
        error: "Không tìm thấy bằng chứng khớp trên mạng lưới Blockchain!",
      });
    }

    // 4. Tính lại hash để đối soát (Phải khớp 11 tham số như Chaincode)
    const gradeFinal = normalizeGrade(certLocal.grade || "");
    const gpaFinal   = normalizeGpa(certLocal.gpa);

    const rawData = [
      certLocal.uuid,
      certLocal.mssv || "KĐ",
      certLocal.fullName || "Ẩn danh",
      certLocal.major || "Không xác định",
      gpaFinal,
      gradeFinal,
      certLocal.issueDate || "",
      certLocal.soHieu || "",
      certLocal.soVaoSo || "",
      certLocal.className || "",
      String(certLocal.namTotNghiep || "")
    ].join("|");

    const currentLocalHash = crypto
      .createHash("sha256")
      .update(rawData)
      .digest("hex");

    const onChainHash  = blockchainResult.certHash;
    const isAuthentic  = currentLocalHash === onChainHash;

    return NextResponse.json({
      success: true,
      isValid: isAuthentic,
      message: isAuthentic
        ? "Xác thực thành công: Văn bằng chính xác và hợp lệ!"
        : "CẢNH BÁO: Dữ liệu văn bằng đã bị thay đổi so với bản gốc!",
      details: {
        studentName:    certLocal.fullName,
        mssv:           certLocal.mssv,
        onChainHash,
        currentHash:    currentLocalHash,
        txId:           certLocal.txId,
        blockchainDate: blockchainResult.dateOfIssuing,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống: " + error.message },
      { status: 500 }
    );
  }
}