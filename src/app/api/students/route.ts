import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { User } from '@/lib/db/models/User';
import bcrypt from 'bcrypt';

export async function POST(req: Request) {
    try {
        await connectDB();
        const body = await req.json();
        const { name, email, studentId } = body;

        // Băm mật khẩu mặc định cho sinh viên là: 123456
        const hashedPassword = await bcrypt.hash('123456', 10);

        // Tạo tài khoản sinh viên, dùng MSSV làm định danh Blockchain sau này
        const newUser = await User.create({
            name,
            email,
            password: hashedPassword,
            role: 'student',
            fabricEnrollmentId: studentId 
        });

        return NextResponse.json({ success: true, message: 'Thêm thành công!' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}