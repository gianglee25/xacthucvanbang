import { connectDB } from '@/lib/db/connect';
import { Certificate } from '@/lib/db/models/Certificate';
import CertificatesClient from './CertificatesClient';

export const dynamic = 'force-dynamic';

export default async function CertificatesPage() {
  await connectDB();
  
  // Lấy toàn bộ danh sách văn bằng, sắp xếp mới nhất lên đầu
  const certs = await Certificate.find({}).sort({ createdAt: -1 }).lean();

  // Chuyển đổi _id thành string để tránh lỗi truyền dữ liệu Server -> Client
  const formattedData = certs.map((c: any) => ({
    ...c,
    _id: c._id.toString(),
    createdBy: c.createdBy ? c.createdBy.toString() : null,
  }));

  return <CertificatesClient data={formattedData} />;
}