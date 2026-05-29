import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Certificate } from "@/lib/db/models/Certificate";

export async function GET() {
  try {
    await connectDB();

    // 1. Thống kê theo ngành học
    const byMajor = await Certificate.aggregate([
      { $match: { status: "ON_CHAIN" } },
      { $group: { _id: "$major", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // 2. Thống kê theo năm tốt nghiệp
    const byYear = await Certificate.aggregate([
      { $match: { status: "ON_CHAIN" } },
      { $group: { _id: "$namTotNghiep", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // 3. Thống kê theo xếp loại
    const byGrade = await Certificate.aggregate([
      { $match: { status: "ON_CHAIN" } },
      { $group: { _id: "$grade", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // 4. Tổng quan
    const total = await Certificate.countDocuments({ status: "ON_CHAIN" });
    const thisMonth = await Certificate.countDocuments({
      status: "ON_CHAIN",
      createdAt: { $gte: new Date(new Date().setDate(1)) }
    });

    return NextResponse.json({
      success: true,
      data: {
        total,
        thisMonth,
        byMajor: byMajor.map(x => ({ name: x._id || "Không xác định", value: x.count })),
        byYear: byYear.map(x => ({ year: String(x._id || ""), count: x.count })),
        byGrade: byGrade.map(x => ({ name: x._id || "Không xác định", value: x.count })),
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
