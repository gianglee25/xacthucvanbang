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

    // ✅ Nhận nhiều dạng input: uuid trực tiếp, certHash, hoặc proofString JSON
    let targetUuid: string | undefined;
    let targetHash: string | undefined;

    if (body.uuid) {
      // Gọi trực tiếp từ CertificatesClient (nút Verify)
      targetUuid = body.uuid;

    } else if (body.certHash) {
      // Gọi với certHash thuần (từ VerifyPage khi user dán hash)
      targetHash = body.certHash;

    } else if (body.proofString) {
      // Gọi với proofString — thử parse JSON
      try {
        const parsed = JSON.parse(body.proofString);
        targetUuid = parsed.certUUID || parsed.uuid;
        targetHash = parsed.certHash;
      } catch {
        return NextResponse.json(
          { success: false, error: "Định dạng minh chứng không hợp lệ. Vui lòng dán đúng Proof JSON." },
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

    // 2. Truy vấn MongoDB — ưu tiên uuid, fallback về certHash
    const query = targetUuid ? { uuid: targetUuid } : { certHash: targetHash };
    const certLocal = await Certificate.findOne(query).lean() as any;

    if (!certLocal) {
      return NextResponse.json({
        success: false,
        error: "Văn bằng không tồn tại trong cơ sở dữ liệu hệ thống!",
      });
    }

    // 3. Truy vấn blockchain bằng uuid từ DB
    let blockchainResult: any;
    try {
      const response = await executeTransaction("evaluate", "QueryCertificate", certLocal.uuid);
      blockchainResult =
        typeof response.result === "string"
          ? JSON.parse(response.result)
          : response.result;

      if (!blockchainResult?.certHash) {
        throw new Error("Dữ liệu trên Blockchain không hợp lệ hoặc bị thiếu mã Hash.");
      }
    } catch (bcError: any) {
      console.error("Blockchain Query Error:", bcError.message);
      return NextResponse.json({
        success: false,
        error: "Không tìm thấy bằng chứng khớp với UUID này trên mạng lưới Blockchain!",
      });
    }

    // 4. Tính lại hash để đối soát
    const gradeFinal = normalizeGrade(certLocal.grade || "");
    const gpaFinal   = normalizeGpa(certLocal.gpa);

    const rawData = [
      certLocal.uuid,
      certLocal.mssv || "KĐ",
      certLocal.fullName || "Ẩn danh",
      certLocal.major || "Không xác định",
      gpaFinal,
      gradeFinal,
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
        : "CẢNH BÁO: Dữ liệu văn bằng không khớp với bản gốc trên Blockchain!",
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
    console.error("Verify API Critical Error:", error.message);
    return NextResponse.json(
      { success: false, error: "Lỗi kết nối máy chủ xác thực: " + error.message },
      { status: 500 }
    );
  }
}