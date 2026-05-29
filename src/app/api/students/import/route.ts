import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import * as XLSX from "xlsx";
import bcrypt from "bcrypt";
import crypto from "crypto";
import nodemailer from "nodemailer";

// Cấu hình email
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Tạo mật khẩu tạm ngẫu nhiên 8 ký tự
function generateTempPassword(): string {
  return crypto.randomBytes(4).toString("hex"); // VD: a3f9b2c1
}

// Gửi email thông báo
async function sendWelcomeEmail(email: string, name: string, mssv: string, tempPassword: string) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Tài khoản Hệ thống Văn bằng Số - ĐH Thủy Lợi",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0056b3; padding: 20px; text-align: center;">
          <h2 style="color: white; margin: 0;">TRƯỜNG ĐẠI HỌC THỦY LỢI</h2>
          <p style="color: #cce0ff; margin: 5px 0;">Hệ thống Văn bằng Số Blockchain</p>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <p>Xin chào <strong>${name}</strong>,</p>
          <p>Tài khoản của bạn đã được tạo trên hệ thống xác thực văn bằng số.</p>
          <div style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p><strong>MSSV:</strong> ${mssv}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Mật khẩu tạm:</strong> <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 16px;">${tempPassword}</code></p>
          </div>
          <p style="color: #e74c3c;"><strong>⚠️ Lưu ý:</strong> Vui lòng đổi mật khẩu sau khi đăng nhập lần đầu.</p>
          <a href="${process.env.NEXTAUTH_URL}/login?type=student" 
             style="display: inline-block; background: #0056b3; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 10px;">
            Đăng nhập ngay
          </a>
        </div>
        <div style="padding: 15px; text-align: center; color: #888; font-size: 12px;">
          © ${new Date().getFullYear()} Trường Đại học Thủy Lợi - Phân hiệu TP.HCM
        </div>
      </div>
    `,
  });
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ success: false, error: "Chưa chọn file!" }, { status: 400 });
    }

    // Đọc file Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: "File Excel trống!" }, { status: 400 });
    }

    let created = 0, skipped = 0, emailFailed = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const mssv = String(row['MSSV'] || row['mssv'] || row['Mã sinh viên'] || '').trim();
        const name = String(row['Họ và tên'] || row['HoTen'] || row['name'] || row['Name'] || '').trim();
        const email = String(row['Email'] || row['email'] || row['EMAIL'] || '').trim();

        if (!mssv || !name || !email) {
          errors.push(`Thiếu thông tin: MSSV=${mssv}, Tên=${name}, Email=${email}`);
          skipped++;
          continue;
        }

        // Kiểm tra đã tồn tại
        const existing = await User.findOne({
          $or: [{ email }, { fabricEnrollmentId: mssv }]
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Tạo mật khẩu tạm
        const tempPassword = generateTempPassword();
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Tạo tài khoản
        await User.create({
          email,
          name,
          mssv,
          fabricEnrollmentId: mssv,
          role: 'student',
          password: hashedPassword,
          mustChangePassword: true, // Flag bắt đổi mật khẩu
        });

        // Gửi email
        try {
          await sendWelcomeEmail(email, name, mssv, tempPassword);
        } catch {
          emailFailed++;
          errors.push(`Tạo tài khoản OK nhưng gửi email thất bại: ${email}`);
        }

        created++;
      } catch (e: any) {
        errors.push(`Lỗi: ${e.message}`);
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Đã tạo ${created} tài khoản. Bỏ qua ${skipped} dòng. Email thất bại: ${emailFailed}.`,
      created,
      skipped,
      emailFailed,
      errors: errors.slice(0, 10),
      total: rows.length,
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
