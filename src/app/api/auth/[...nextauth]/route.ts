import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import bcrypt from "bcrypt";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text" },
      },
      async authorize(credentials) {
        // 1. Kiểm tra đầu vào
        if (
          !credentials?.email ||
          !credentials?.password ||
          !credentials?.role
        ) {
          throw new Error("Vui lòng nhập đầy đủ thông tin đăng nhập!");
        }

        await connectDB();

        // 2. Tìm User trong cơ sở dữ liệu MongoDB
        // Lưu ý: Cần thêm .select("+password") nếu schema của bạn để select: false cho field password
        const user = await User.findOne({ email: credentials.email }).lean();

        if (!user) {
          throw new Error("Tài khoản không tồn tại trong hệ thống!");
        }

        // 3. Kiểm tra mật khẩu bằng bcrypt
        const isPasswordMatch = await bcrypt.compare(
          credentials.password,
          user.password as string,
        );
        if (!isPasswordMatch) {
          throw new Error("Mật khẩu không chính xác!");
        }

        // 4. Kiểm tra quyền đăng nhập (Role)
        // Ngăn chặn sinh viên đăng nhập vào cổng nhà trường và ngược lại
        if (
          String(user.role).toUpperCase() !==
          String(credentials.role).toUpperCase()
        ) {
          throw new Error(
            "Sai cổng đăng nhập! Vui lòng chọn đúng tab Sinh viên hoặc Nhà trường.",
          );
        }

        // 5. Trả về object User (Dữ liệu này sẽ được truyền vào JWT Token)
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          mssv: user.mssv || user.fabricEnrollmentId,
        };
      },
    }),
  ],
  callbacks: {
    // 6. Gắn thêm Role và MSSV vào JWT Token
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.mssv = (user as any).mssv;
      }
      return token;
    },
    // 7. Truyền dữ liệu từ JWT Token ra Session Frontend
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).mssv = token.mssv;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login", // Trỏ đến trang đăng nhập bạn vừa viết
  },
  session: {
    strategy: "jwt", // Sử dụng Json Web Token để lưu phiên
    maxAge: 30 * 24 * 60 * 60, // Phiên đăng nhập sống 30 ngày
  },
  secret: process.env.NEXTAUTH_SECRET, // Nhớ thêm khóa này vào file .env
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
