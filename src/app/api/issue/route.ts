import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Certificate } from "@/lib/db/models/Certificate";
import { User } from "@/lib/db/models/User";
import { DIPLOMA_STATUS } from "@/utils/constants";
import { executeTransaction } from "@/lib/fabric/fabricService";

export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json();
    const { studentObjId, major, gpa, classification } = body;

    // 1. Tìm sinh viên
    const user = await User.findById(studentObjId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy sinh viên" },
        { status: 404 },
      );
    }

    const mssv = user.fabricEnrollmentId || user.mssv;
    const certUuid = crypto.randomUUID();
    
    // CHUẨN HÓA: GPA phải luôn có 2 chữ số thập phân (Ví dụ: 3.7 -> "3.70")
    const safeGpa = Number(gpa).toFixed(2);
    const issueDate = new Date().toISOString().split("T")[0];

    // 2. GỌI BLOCKCHAIN (ON-CHAIN)
    // KHÔNG BĂM Ở ĐÂY NỮA -> Đẩy trực tiếp các tham số thô xuống để Smart Contract tự băm và tự kiểm định
    let finalTxId = "";
    let blockchainHash = "";
    
    try {
      const response = await executeTransaction(
        "submit",
        "IssueCertificate",
        certUuid,          // Tham số 1: certUUID
        mssv,              // Tham số 2: mssv
        user.name,         // Tham số 3: studentName
        major,             // Tham số 4: major
        safeGpa,           // Tham số 5: gpaStr
        classification,    // Tham số 6: classification
        issueDate          // Tham số 7: issueDate
      );

      // Nhận kết quả JSON trả về từ Smart Contract TypeScript mới
      // (Bản TypeScript trả về: { success: true, txId: ..., hash: ... })
      const chaincodeResult = JSON.parse(response.payload || "{}");
      
      finalTxId = response.txId || chaincodeResult.txId;
      blockchainHash = chaincodeResult.hash; // Lấy mã băm khách quan do chính Blockchain tính toán

      if (!finalTxId) {
          throw new Error("Blockchain không trả về Transaction ID");
      }
    } catch (bcError: any) {
      console.error("Blockchain Error:", bcError.message);
      // Nếu có lỗi validation on-chain (Ví dụ: Điểm GPA sai quy chế), lỗi sẽ bắn ra ở đây
      return NextResponse.json(
        { success: false, error: `Cổng kiểm định Blockchain từ chối: ${bcError.message}` },
        { status: 400 },
      );
    }

    // 3. GHI VÀO MONGODB (Đồng bộ mã băm gốc từ Blockchain về)
    const newCert = await Certificate.create({
      fullName: user.name,
      mssv: mssv,
      major: major,
      gpa: Number(safeGpa),
      grade: classification,
      certHash: blockchainHash, // Mã băm này lấy từ kết quả On-chain trả về
      uuid: certUuid,
      txId: finalTxId,
      status: DIPLOMA_STATUS.ON_CHAIN,
      issueDate: issueDate
    });

    // 4. Trả về kết quả cho Giao diện hiển thị
    return NextResponse.json({
      success: true,
      hash: blockchainHash,
      txId: finalTxId,
      uuid: certUuid,
    });
  } catch (error: any) {
    console.error("API Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}