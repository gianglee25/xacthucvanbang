import FabricCAServices from 'fabric-ca-client';
import * as fs from 'fs';
import * as path from 'path';

export async function enrollAdmin() {
    try {
        console.log("--- Bắt đầu quy trình Enroll Admin ---");

        // 1. Đọc cấu hình mạng
        const ccpPath = path.resolve(process.cwd(), 'src', 'config', 'connection-org1.json');
        if (!fs.existsSync(ccpPath)) {
            throw new Error(`Không tìm thấy file cấu hình tại: ${ccpPath}`);
        }
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // 2. Nạp chứng chỉ CA gốc (ĐÃ FIX LỖI TLS)
        const caCertPath = path.resolve(process.cwd(), 'src', 'config', 'ca-cert.pem');
        if (!fs.existsSync(caCertPath)) {
            throw new Error(`LỖI: Chưa có file ca-cert.pem tại: ${caCertPath}. Hãy copy file localhost-7054... vào đây.`);
        }
        const caTLSCACerts = fs.readFileSync(caCertPath);

        // 3. Khởi tạo CA Client với bảo mật TLS chuẩn
        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        const ca = new FabricCAServices(
            caInfo.url, 
            { 
                trustedRoots: caTLSCACerts, 
                verify: false// Đã bật kiểm tra TLS an toàn
            }, 
            caInfo.caName
        );

        // 4. Khởi tạo ví
        const walletPath = path.join(process.cwd(), 'wallet');
        if (!fs.existsSync(walletPath)) {
            fs.mkdirSync(walletPath, { recursive: true });
        }

        const adminIdentityPath = path.join(walletPath, 'admin.json');

        // 5. Enroll nếu chưa có
        if (fs.existsSync(adminIdentityPath)) {
            console.log('✅ Admin đã tồn tại trong wallet. Không cần enroll lại.');
            return;
        }

        const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
        
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };

        fs.writeFileSync(adminIdentityPath, JSON.stringify(x509Identity, null, 2));
        console.log(`🎉 THÀNH CÔNG: Đã lưu chứng chỉ vào: ${adminIdentityPath}`);

    } catch (error) {
        console.error(`❌ THẤT BẠI: ${error}`);
        process.exit(1);
    }
}

// Chạy hàm
enrollAdmin();