import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { User } from '@/lib/db/models/User';
import bcrypt from 'bcrypt';

export async function POST(req: Request) {
    try {
        await connectDB();
        const body = await req.json();
        const { mssv, email, password, role } = body;

        // 1. Kiểm tra đầu vào cơ bản
        if (!email || !password || !role) {
            return NextResponse.json(
                { success: false, error: 'Vui lòng nhập đầy đủ thông tin!' }, 
                { status: 400 }
            );
        }

        // ==========================================
        // LUỒNG ĐĂNG KÝ CHO SINH VIÊN (STUDENT)
        // ==========================================
        if (role.toUpperCase() === 'STUDENT') {
            if (!mssv) {
                return NextResponse.json({ success: false, error: 'Sinh viên bắt buộc phải có MSSV!' }, { status: 400 });
            }

            // ĐỐI CHIẾU CHÉO (CROSS-CHECK): Tìm sinh viên đã được nhà trường Import
            const existingStudent = await User.findOne({ 
                $or: [{ mssv: mssv }, { fabricEnrollmentId: mssv }],
                email: email,
                role: { $regex: new RegExp('^student$', 'i') }
            });

            if (!existingStudent) {
                return NextResponse.json({ 
                    success: false, 
                    error: 'MSSV hoặc Email không tồn tại trong hệ thống đào tạo. Bạn chưa được nhà trường cấp định danh!' 
                }, { status: 403 });
            }

            // Kích hoạt: Cập nhật mật khẩu mới (Băm bằng bcrypt)
            const hashedPassword = await bcrypt.hash(password, 10);
            existingStudent.password = hashedPassword;
            await existingStudent.save();

            return NextResponse.json({ 
                success: true, 
                message: 'Đăng ký và kích hoạt tài khoản thành công! Bạn có thể đăng nhập.' 
            });
        }

        // ==========================================
        // LUỒNG ĐĂNG KÝ CHO CÁN BỘ (UNIVERSITY)
        // ==========================================
        if (role.toUpperCase() === 'UNIVERSITY') {
            // Nghiệp vụ: Cán bộ phải dùng email đuôi @tlu.edu.vn
            if (!email.endsWith('@tlu.edu.vn')) {
                return NextResponse.json({ success: false, error: 'Cán bộ phải sử dụng email nội bộ @tlu.edu.vn' }, { status: 403 });
            }

            const existingAdmin = await User.findOne({ email });
            if (existingAdmin) {
                return NextResponse.json({ success: false, error: 'Email cán bộ này đã tồn tại!' }, { status: 400 });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            await User.create({
                email: email,
                password: hashedPassword,
                name: 'Cán bộ ĐHTL Mới',
                role: 'UNIVERSITY',
                fabricEnrollmentId: `tlu_admin_${Date.now()}` // Định danh tạm
            });

            return NextResponse.json({ success: true, message: 'Đăng ký tài khoản Nhà trường thành công!' });
        }

        return NextResponse.json({ success: false, error: 'Role không hợp lệ!' }, { status: 400 });

    } catch (error: any) {
        console.error("Lỗi Đăng ký:", error);
        return NextResponse.json({ success: false, error: 'Lỗi máy chủ nội bộ' }, { status: 500 });
    }
}