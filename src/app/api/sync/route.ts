import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Certificate } from "@/lib/db/models/Certificate";
import { executeTransaction } from "@/lib/fabric/fabricService";

export async function POST() {
  try {
    console.log("=== BẮT ĐẦU QUY TRÌNH TỰ PHỤC HỒI (SELF-HEALING) ===");

    // 1. Kết nối database
    await connectDB();

    // 2. Truy vấn dữ liệu từ Blockchain
    const response = await executeTransaction(
      "evaluate",
      "QueryAllCertificates",
    );

    // Debug log để hội đồng thấy rõ dữ liệu đang kéo về là gì
    console.log(
      "Dữ liệu nhận từ Blockchain (Raw):",
      JSON.stringify(response.result, null, 2),
    );

    const allCertsOnChain =
      typeof response.result === "string"
        ? JSON.parse(response.result)
        : response.result;

    if (!allCertsOnChain || allCertsOnChain.length === 0) {
      console.warn("⚠️ Blockchain trống, không có dữ liệu để sync.");
      return NextResponse.json(
        {
          success: false,
          message: "Blockchain hiện tại chưa có dữ liệu (Ledger is empty).",
        },
        { status: 400 },
      );
    }

    // 3. Xóa dữ liệu cũ trong MongoDB
    const deleteRes = await Certificate.deleteMany({});
    console.log(`[MongoDB] Đã xóa ${deleteRes.deletedCount} bản ghi cũ.`);

    // 4. Transform dữ liệu (Đảm bảo khớp với Schema của Model)
    // 4. Transform dữ liệu (Sửa lại cho khớp với Schema MongoDB của bạn)
    const syncData = allCertsOnChain.map((item: any) => {
      const record = item.Record || item;
      return {
        uuid: record.certUUID,
        certHash: record.certHash,

        // SỬA TẠI ĐÂY: Map đúng tên field từ Blockchain sang Model
        fullName: record.studentName, // Đổi từ studentName -> fullName
        mssv: record.mssv || "N/A", // Blockchain của bạn đang thiếu mssv, cần cung cấp giá trị mặc định

        major: record.major,
        issueDate: record.dateOfIssuing, // Map sang issueDate
        status: "ON_CHAIN",
      };
    });
    // 5. Insert theo batch để đảm bảo an toàn cho RAM
    const BATCH_SIZE = 500;
    let count = 0;
    for (let i = 0; i < syncData.length; i += BATCH_SIZE) {
      const batch = syncData.slice(i, i + BATCH_SIZE);
      await Certificate.insertMany(batch);
      count += batch.length;
    }

    console.log(`✅ Phục hồi hoàn tất: ${count} văn bằng.`);

    return NextResponse.json({
      success: true,
      message: `Hệ thống đã tự phục hồi thành công ${count} văn bằng từ sổ cái Blockchain.`,
    });
  } catch (error: any) {
    // Ghi log chi tiết lỗi vào Terminal để debug
    console.error("❌ Lỗi tiến trình Sync:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error.message || "Đã xảy ra lỗi không xác định trong quá trình sync.",
      },
      { status: 500 },
    );
  }
}
