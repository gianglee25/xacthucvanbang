// src/app/(admin)/users/page.tsx
import React from 'react';
import { connectDB } from '@/lib/db/connect';
import { User } from '@/lib/db/models/User';
import UserTable from './UserTable';

export default async function ListUserPage() {
  // 1. Kết nối DB Off-chain
  await connectDB();
  
  // 2. Lấy danh sách toàn bộ người dùng và sắp xếp mới nhất lên đầu
  const rawUsers = await User.find({}).sort({ createdAt: -1 }).lean();

  // 3. Chuẩn hóa dữ liệu (Serialize) để truyền xuống Client
  const users = rawUsers.map((user: any, index: number) => ({
    key: user._id.toString(),
    stt: index + 1,
    fullName: user.name, // Lấy từ trường name trong Schema
    email: user.email,
    role: user.role,
    hasCertificate: !!user.certificate, // Kiểm tra xem đã có chứng chỉ X.509 từ Fabric CA chưa
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <UserTable data={users} />
    </div>
  );
}