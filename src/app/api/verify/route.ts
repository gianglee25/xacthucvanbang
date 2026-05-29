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
  return GRADE_MAP[norm] || raw;
}

function normalizeGpa(raw: string | number | undefined | null): string {
  const s = String(raw ?? "").trim();
  const n = Number(s);
  return s && !isNaN(n) && n >= 0 && n <= 4 ? n.toFixed(2) : "2.00";
}

function computeHash(data: {
  uuid: string, mssv: string, fullName: string, major: string,
  gpa: any, grade: string, issueDate: string, soHieu: string,
  soVaoSo: string, className: string, namTotNghiep: any
}): string {
  const rawData = [
    data.uuid,
    data.mssv         || "KĐ",
    data.fullName     || "Ẩn danh",
    data.major        || "Không xác định",
    normalizeGpa(data.gpa),
    normalizeGrade(data.grade || ""),
    data.issueDate    || "",
    data.soHieu       || "",
    data.soVaoSo      || "",
    data.className    || "",
    String(data.namTotNghiep || "")
  ].join("|");
  return crypto.createHash("sha256").update(rawData).digest("hex");
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();

    // 1. Parse proofString
    let proof: any;
    if (body.proofString) {
      try {
        proof = JSON.parse(body.proofString);
      } catch {
        return NextResponse.json(
          { success: false, error: "Định dạng minh chứng không hợp lệ." },
          { status: 400 }
        );
      }
    } else {
      proof = body;
    }

    const certUUID = proof.certUUID || proof.uuid;
    if (!certUUID) {
      return NextResponse.json(
        { success: false, error: "Minh chứng thiếu certUUID!" },
        { status: 400 }
      );
    }

    // 2. Lấy hash on-chain từ Blockchain
    let blockchainResult: any;
    try {
      const response = await executeTransaction("evaluate", "QueryCertificate", certUUID);
      blockchainResult = typeof response.result === "string"
        ? JSON.parse(response.result)
        : response.result;
      if (!blockchainResult?.certHash) throw new Error("Blockchain data invalid");
    } catch {
      return NextResponse.json({
        success: false,
        error: "Không tìm thấy văn bằng trên Blockchain!",
      });
    }

    // 3. Lấy dữ liệu từ MongoDB
    const certDB = await Certificate.findOne({ uuid: certUUID }).lean() as any;
    if (!certDB) {
      return NextResponse.json({
        success: false,
        isValid: false,
        error: "Văn bằng không tồn tại trong cơ sở dữ liệu!",
      });
    }

    // 4. Tính hash từ proofString
    const proofHash = computeHash({
      uuid: certUUID,
      mssv: proof.mssv, fullName: proof.fullName,
      major: proof.major, gpa: proof.gpa, grade: proof.grade,
      issueDate: proof.issueDate, soHieu: proof.soHieu,
      soVaoSo: proof.soVaoSo, className: proof.className,
      namTotNghiep: proof.namTotNghiep
    });

    // 5. Tính hash từ MongoDB
    const dbHash = computeHash({
      uuid: certDB.uuid,
      mssv: certDB.mssv, fullName: certDB.fullName,
      major: certDB.major, gpa: certDB.gpa, grade: certDB.grade,
      issueDate: certDB.issueDate, soHieu: certDB.soHieu,
      soVaoSo: certDB.soVaoSo, className: certDB.className,
      namTotNghiep: certDB.namTotNghiep
    });

    const onChainHash = blockchainResult.certHash;

    // 6. So sánh 3 chiều
    const proofMatchChain = proofHash === onChainHash;
    const dbMatchChain    = dbHash === onChainHash;
    const isAuthentic     = proofMatchChain && dbMatchChain;

    let message = "Xác thực thành công: Văn bằng chính xác và hợp lệ!";
    if (!proofMatchChain && !dbMatchChain) {
      message = "CẢNH BÁO: Cả minh chứng và cơ sở dữ liệu đều bị thay đổi!";
    } else if (!proofMatchChain) {
      message = "CẢNH BÁO: Minh chứng đã bị giả mạo so với bản gốc trên Blockchain!";
    } else if (!dbMatchChain) {
      message = "CẢNH BÁO: Dữ liệu trong hệ thống đã bị thay đổi so với Blockchain!";
    }

    return NextResponse.json({
      success: true,
      isValid: isAuthentic,
      message,
      details: {
        studentName:    certDB.fullName,
        mssv:           certDB.mssv,
        major:          certDB.major,
        gpa:            certDB.gpa,
        grade:          certDB.grade,
        issueDate:      certDB.issueDate,
        soHieu:         certDB.soHieu,
        namTotNghiep:   certDB.namTotNghiep,
        txId:           certDB.txId,
        onChainHash,
        proofHash,
        dbHash,
        proofMatchChain,
        dbMatchChain,
      },
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống: " + error.message },
      { status: 500 }
    );
  }
}
