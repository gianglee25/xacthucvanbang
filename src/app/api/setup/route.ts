import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { User } from '@/lib/db/models/User';
import bcrypt from 'bcrypt';

export async function GET() {
  try {
    await connectDB();

    const adminEmail = 'admin@tlu.edu.vn';
    const existingUser = await User.findOne({ email: adminEmail });

    if (existingUser) {
      return NextResponse.json({ message: 'Tài khoản admin đã tồn tại sẵn!' });
    }

    // Băm mật khẩu (mật khẩu gốc là: 123456)
    const hashedPassword = await bcrypt.hash('123456', 10);

    // Tạo tài khoản Cán bộ ĐHTL, liên kết với định danh Blockchain
    await User.create({
      email: adminEmail,
      password: hashedPassword,
      name: 'Cán bộ ĐHTL',
      role: 'university',
      fabricEnrollmentId: 'tlu_admin' // CỰC KỲ QUAN TRỌNG: Map với chứng chỉ X.509
    });

    return NextResponse.json({ message: 'Đã tạo thành công tài khoản Cán bộ Trường (admin@tlu.edu.vn / 123456)' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}