import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connect';
import { User } from '@/lib/db/models/User';
import bcrypt from 'bcrypt';

export async function POST(req: Request) {
    try {
        await connectDB();

        const body = await req.json();
        // Giao diện (Frontend) khi đọc file CSV/Excel của TLU xong 
        // sẽ truyền mảng dữ liệu vào biến `studentsList` này
        const { studentsList } = body;

        if (!studentsList || !Array.isArray(studentsList) || studentsList.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Dữ liệu không hợp lệ. Cần một mảng studentsList!' }, 
                { status: 400 }
            );
        }

        // Băm sẵn mật khẩu mặc định "123456" ở ngoài vòng lặp để tăng tốc độ xử lý (Tối ưu hiệu năng)
        const defaultPassword = await bcrypt.hash('123456', 10);
        
        let importedCount = 0;
        let skippedCount = 0;
        const importedData = [];

        // Duyệt qua từng dòng sinh viên trong file Sổ gốc thực tế của Đại học Thủy Lợi
        for (const row of studentsList) {
            // 🔍 ÁNH XẠ TIÊU ĐỀ CỘT TIẾNG VIỆT THỰC TẾ
            const mssvStr = (row["MSSV"] || row["Mã SV"] || row.studentId)?.toString()?.trim();
            const fullName = row["Họ và tên"] || row.name;
            const majorStr = row["Ngành đào tạo"] || row["Ngành"] || row.major || 'Hệ thống thông tin';

            // Nếu gặp dòng trống hoặc thiếu thông tin cốt lõi thì bỏ qua dòng đó
            if (!mssvStr || !fullName) {
                skippedCount++;
                continue;
            }

            // Kiểm tra xem sinh viên này đã có tài khoản trong MongoDB chưa (Tránh trùng lặp tài khoản)
            const existingUser = await User.findOne({ 
                $or: [{ mssv: mssvStr }, { fabricEnrollmentId: mssvStr }] 
            });

            if (!existingUser) {
                // Tạo tài khoản sinh viên mới tinh
                const newUser = await User.create({
                    name: fullName.trim(), 
                    email: row.email || `${mssvStr}@student.tlu.edu.vn`, // Tự động cấu hình email sinh viên trường Thủy Lợi
                    password: defaultPassword,
                    role: 'student',
                    fabricEnrollmentId: mssvStr, // Gán MSSV làm mã ID định danh kết nối với ví Fabric (Wallet) sau này
                    major: majorStr.trim()       // Nhận chính xác ngành học thực tế từ file (Ví dụ: Công nghệ thông tin)
                });
                
                importedCount++;
                importedData.push({
                    id: newUser._id,
                    mssv: mssvStr,
                    name: fullName
                });
            } else {
                // Nếu tài khoản MSSV này đã tồn tại rồi, ta bỏ qua (Không tạo đè để bảo vệ mật khẩu cũ của họ)
                skippedCount++;
            }
        }

        console.log(`[HỆ THỐNG ĐỊNH DANH] Import hoàn tất. Thêm mới thành công: ${importedCount} tài khoản.`);
        
        return NextResponse.json({ 
            success: true, 
            message: `Thêm mới thành công: ${importedCount} sinh viên, Bỏ qua trùng lặp: ${skippedCount}`,
            data: importedData
        });

    } catch (error: any) {
        console.error("Lỗi API Import Sinh Viên:", error.message);
        return NextResponse.json({ success: false, error: 'Lỗi máy chủ hệ thống nội bộ' }, { status: 500 });
    }
}