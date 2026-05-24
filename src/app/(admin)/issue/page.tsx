import { connectDB } from '@/lib/db/connect';
import { User } from '@/lib/db/models/User';
import { Certificate } from '@/lib/db/models/Certificate'; // 1. BẮT BUỘC THÊM IMPORT NÀY
import IssueClient from './IssueClient';

export const dynamic = 'force-dynamic';

export default async function IssuePage() {
  await connectDB();

  // 2. Lấy danh sách tất cả các MSSV đã được cấp văn bằng (Nằm trong collection Certificates)
  const issuedCerts = await Certificate.find({}).select('mssv').lean();
  const issuedMssvList = issuedCerts.map((cert: any) => cert.mssv);

  // 3. Lấy toàn bộ sinh viên trong hệ thống
  const allStudents = await User.find({ role: 'student' }).lean();
  
  // 4. Lọc ra những sinh viên CHƯA ĐƯỢC CẤP BẰNG
  const unissuedStudents = allStudents.filter((student: any) => {
    // Lấy mssv của sinh viên (ưu tiên fabricEnrollmentId nếu có, không thì lấy mssv)
    const studentMssv = student.fabricEnrollmentId || student.mssv;
    
    // Chỉ giữ lại sinh viên nếu mssv CỦA HỌ KHÔNG NẰM TRONG danh sách đã cấp
    return !issuedMssvList.includes(studentMssv);
  });

  // 5. Định dạng lại dữ liệu để truyền vào giao diện Select của Ant Design
  const formattedStudents = unissuedStudents.map((s: any) => ({
    value: s._id.toString(),
    label: `${s.name} - MSSV: ${s.fabricEnrollmentId || s.mssv || 'Chưa định danh'}`
  }));

  return <IssueClient students={formattedStudents} />;
}