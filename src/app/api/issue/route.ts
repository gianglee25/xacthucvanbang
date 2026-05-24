import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Certificate } from "@/lib/db/models/Certificate";
import { User } from "@/lib/db/models/User";
import { DIPLOMA_STATUS } from "@/utils/constants";
import { executeTransaction } from "@/lib/fabric/fabricService";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json();
    console.log("DEBUG [API/ISSUE] Body nhận được:", body);

    const { 
      studentObjId, major, gpa, classification, 
      soHieu, soVaoSo, className, namTotNghiep 
    } = body;

    // 1. Tìm sinh viên
    const user = await User.findById(studentObjId);
    if (!user) {
      console.log("DEBUG [API/ISSUE] Không tìm thấy User với ID:", studentObjId);
      return NextResponse.json(
        { success: false, error: "Không tìm thấy sinh viên" },
        { status: 404 },
      );
    }

    const mssv = user.fabricEnrollmentId || user.mssv;
    const certUuid = randomUUID();
    const safeGpa = Number(gpa).toFixed(2);
    const issueDate = new Date().toISOString().split("T")[0];

    // 2. GỌI BLOCKCHAIN (ON-CHAIN)
    let finalTxId = "";
    let blockchainHash = "";
    
    try {
      console.log("DEBUG [API/ISSUE] Chuẩn bị gọi Chaincode với tham số:", {
        certUuid, mssv, name: user.name, major, safeGpa, classification, issueDate, soHieu, soVaoSo, className, namTotNghiep
      });

      // Gọi Chaincode với 11 tham số chuẩn xác
      const response = await executeTransaction(
        "submit",
        "IssueCertificate",
        certUuid, 
        mssv, 
        user.name, 
        major, 
        safeGpa, 
        classification, 
        issueDate, 
        soHieu, 
        soVaoSo, 
        className || "", 
        String(namTotNghiep || "")
      );

      const chaincodeResult = JSON.parse(response.payload || "{}");
      console.log("DEBUG [API/ISSUE] Kết quả từ Chaincode:", chaincodeResult);
      
      finalTxId = response.txId || chaincodeResult.txId;
      blockchainHash = chaincodeResult.hash; 

      if (!finalTxId) throw new Error("Blockchain không trả về Transaction ID");
    } catch (bcError: any) {
      console.error("DEBUG [API/ISSUE] LỖI CHAINCODE:", bcError.message);
      return NextResponse.json(
        { success: false, error: `Cổng kiểm định Blockchain từ chối: ${bcError.message}` },
        { status: 400 },
      );
    }

    // 3. GHI VÀO MONGODB
    // Đảm bảo tên trường khớp với Schema trong Certificate.ts
    await Certificate.create({
      uuid: certUuid,
      certHash: blockchainHash,
      txId: finalTxId,
      mssv: mssv,
      fullName: user.name,
      major: major,
      gpa: Number(safeGpa),
      grade: classification,
      issueDate: issueDate,
      soHieu: soHieu,
      soVaoSo: soVaoSo,
      className: className,
      namTotNghiep: Number(namTotNghiep),
      status: DIPLOMA_STATUS?.ON_CHAIN || 'ON_CHAIN',
      createdBy: user._id
    });

    console.log("DEBUG [API/ISSUE] Ghi vào MongoDB thành công!");

    return NextResponse.json({ 
      success: true, 
      hash: blockchainHash, 
      txId: finalTxId, 
      uuid: certUuid 
    });
  } catch (error: any) {
    console.error("DEBUG [API/ISSUE] LỖI SERVER:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}