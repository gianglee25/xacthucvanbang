import { connectDB } from '@/lib/db/connect';
import { User } from '@/lib/db/models/User';
import StudentsClient from './StudentsClient';

// Đảm bảo Next.js không cache trang này để luôn thấy sinh viên mới thêm
export const dynamic = 'force-dynamic';

export default async function StudentsPage() {
  await connectDB();
  
  // Lấy toàn bộ danh sách sinh viên từ MongoDB
  const students = await User.find({ role: 'student' }).sort({ createdAt: -1 }).lean();

  // Chuyển đổi dữ liệu cho khớp với bảng Ant Design
  const formattedData = students.map((s: any) => ({
    id: s._id.toString(),
    name: s.name,
    email: s.email,
    studentId: s.fabricEnrollmentId || 'Chưa định danh',
  }));

  return <StudentsClient initialData={formattedData} />;
}