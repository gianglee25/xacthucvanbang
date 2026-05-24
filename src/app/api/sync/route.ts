import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Certificate } from "@/lib/db/models/Certificate";
import { executeTransaction } from "@/lib/fabric/fabricService";

export async function POST() {
  try {
    console.log("=== BẮT ĐẦU QUY TRÌNH TỰ PHỤC HỒI (SELF-HEALING) 11 THAM SỐ ===");

    // 1. Kết nối database
    await connectDB();

    // 2. Truy vấn dữ liệu từ Blockchain
    const response = await executeTransaction("evaluate", "QueryAllCertificates");
    const allCertsOnChain = typeof response.result === "string" ? JSON.parse(response.result) : response.result;

    if (!allCertsOnChain || allCertsOnChain.length === 0) {
      return NextResponse.json({ success: false, message: "Blockchain hiện tại chưa có dữ liệu." }, { status: 400 });
    }

    // 3. Xóa dữ liệu cũ (Xóa để đồng bộ lại hoàn toàn từ Blockchain là Single Source of Truth)
    await Certificate.deleteMany({});
    console.log(`[MongoDB] Đã xóa toàn bộ dữ liệu cũ để đồng bộ lại.`);

    // 4. Transform dữ liệu (Map đúng 11 tham số từ Chaincode về MongoDB)
    const syncData = allCertsOnChain.map((item: any) => {
      const r = item.Record || item;
      return {
        uuid:         r.certUUID,
        certHash:     r.certHash,
        mssv:         r.mssv,
        fullName:     r.studentName,
        major:        r.major,
        gpa:          Number(r.gpa),
        grade:        r.grade,
        issueDate:    r.issueDate,
        
        // Map 4 trường mới bổ sung
        soHieu:       r.soHieu,
        soVaoSo:      r.soVaoSo,
        className:    r.className,
        namTotNghiep: Number(r.namTotNghiep),
        
        status:       "ON_CHAIN"
      };
    });

    // 5. Insert theo batch
    const BATCH_SIZE = 500;
    let count = 0;
    for (let i = 0; i < syncData.length; i += BATCH_SIZE) {
      await Certificate.insertMany(syncData.slice(i, i + BATCH_SIZE));
      count += BATCH_SIZE;
    }

    console.log(`✅ Phục hồi hoàn tất: ${syncData.length} văn bằng đã đồng bộ.`);

    return NextResponse.json({
      success: true,
      message: `Hệ thống đã phục hồi thành công ${syncData.length} văn bằng.`,
    });
  } catch (error: any) {
    console.error("❌ Lỗi tiến trình Sync:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}