import { connectDB } from '@/lib/db/connect';
import { Certificate } from '@/lib/db/models/Certificate';
import { User } from '@/lib/db/models/User';
import DashboardClient from './DashboardClient';

export default async function UniversityDashboard() {
  await connectDB();
  
  // Chỉ lấy đúng 3 con số cần thiết cho minh chứng luồng dữ liệu
  const [totalStudents, totalOffChain, totalOnChain] = await Promise.all([
    User.countDocuments({ role: 'student' }),
    Certificate.countDocuments(),
    Certificate.countDocuments({ status: 'ON_CHAIN' }) ]);

  return <DashboardClient stats={{ totalStudents, totalOffChain, totalOnChain }} />;
}