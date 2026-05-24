import FabricCAServices from 'fabric-ca-client';
import { User } from 'fabric-common';
import * as fs from 'fs';
import * as path from 'path';

export async function registerUser(newUserName: string = 'appUser') {
    try {
        // 1. Đọc cấu hình mạng
        const ccpPath = path.resolve(process.cwd(), 'src', 'lib', 'fabric', 'config', 'connection-org1.json');
        if (!fs.existsSync(ccpPath)) {
            throw new Error(`Không tìm thấy file cấu hình tại: ${ccpPath}`);
        }
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // 2. Khởi tạo dịch vụ CA
        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caInfo.tlsCACerts.pem, verify: false }, caInfo.caName);

        // 3. Đường dẫn ví điện tử (quản lý bằng file system trực tiếp)
        const walletPath = path.join(process.cwd(), 'wallet');
        const newUserIdentityPath = path.join(walletPath, `${newUserName}.json`);
        const adminIdentityPath = path.join(walletPath, 'admin.json');

        // 4. Kiểm tra appUser đã tồn tại chưa
        if (fs.existsSync(newUserIdentityPath)) {
            console.log(`Danh tính "${newUserName}" đã tồn tại trong ví.`);
            return;
        }

        // 5. Kiểm tra quyền Admin
        if (!fs.existsSync(adminIdentityPath)) {
            console.log('Admin chưa tồn tại. Vui lòng chạy enrollAdmin trước.');
            return;
        }

        // 6. Nạp thông tin Admin từ file .json đã lưu ở bước enrollAdmin
        const adminIdentity = JSON.parse(fs.readFileSync(adminIdentityPath, 'utf8'));

        // Xây dựng bối cảnh danh tính Admin (Thay thế cho wallet.getProviderRegistry của fabric-network)
        const provider = FabricCAServices.newCryptoSuite();
        const adminUser = new User('admin');
        
        // Khôi phục khóa bí mật của Admin để làm người ủy quyền (registrar)
        const privateKeyObj = await provider.importKey(adminIdentity.credentials.privateKey, { ephemeral: true });
        await adminUser.setEnrollment(privateKeyObj, adminIdentity.credentials.certificate, adminIdentity.mspId);

        // 7. Đăng ký (Register) người dùng mới với CA server
        const secret = await ca.register({
            affiliation: 'org1.department1',
            enrollmentID: newUserName,
            role: 'client'
        }, adminUser);

        // 8. Cấp phát chứng chỉ (Enroll) dựa trên secret vừa nhận
        const enrollment = await ca.enroll({
            enrollmentID: newUserName,
            enrollmentSecret: secret
        });

        // 9. Tạo định dạng X.509 để lưu vào ví
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };

        // 10. Lưu file
        fs.writeFileSync(newUserIdentityPath, JSON.stringify(x509Identity, null, 2));
        console.log(`THÀNH CÔNG: Đã đăng ký "${newUserName}" và lưu vào: ${newUserIdentityPath}`);

    } catch (error) {
        console.error(`THẤT BẠI: Lỗi khi đăng ký user: ${error}`);
        throw error;
    }
}