import FabricCAServices from 'fabric-ca-client';
import { User } from 'fabric-common';
import * as fs from 'fs';
import * as path from 'path';

// Trỏ đường dẫn chuẩn theo cấu trúc Next.js src/
const ccpPath = path.resolve(process.cwd(), 'src', 'lib', 'fabric', 'config', 'connection-org1.json');
const walletPath = path.join(process.cwd(), 'wallet');

let caInstance: FabricCAServices | null = null;

// Hàm hỗ trợ khởi tạo CA Instance dùng chung
const getCAInstance = (): FabricCAServices => {
    if (caInstance) return caInstance;

    if (!fs.existsSync(ccpPath)) {
        throw new Error(`Không tìm thấy file cấu hình tại: ${ccpPath}`);
    }

    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
    const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
    
    caInstance = new FabricCAServices(caInfo.url, { trustedRoots: caInfo.tlsCACerts?.pem, verify: false }, caInfo.caName);
    return caInstance;
};

// Hàm 1: Khởi tạo Admin CA (Chỉ chạy 1 lần khi startup)
export const enrollAdmin = async (): Promise<void> => {
    const ca = getCAInstance();
    
    if (!fs.existsSync(walletPath)) {
        fs.mkdirSync(walletPath, { recursive: true });
    }
    
    const adminIdentityPath = path.join(walletPath, 'admin.json');
    if (fs.existsSync(adminIdentityPath)) {
        console.log('Danh tính "admin" đã tồn tại trong wallet.');
        return;
    }

    const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
    const x509Identity = {
        credentials: { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() },
        mspId: 'Org1MSP',
        type: 'X.509',
    };
    
    fs.writeFileSync(adminIdentityPath, JSON.stringify(x509Identity, null, 2));
    console.log('Successfully enrolled admin and imported it into the wallet');
};

// Hàm 2: Đăng ký và Ghi danh User (Chỉ gọi khi University phê duyệt)
export const registerAndEnrollUser = async (email: string, role: string): Promise<string> => {
    const ca = getCAInstance();

    const userIdentityPath = path.join(walletPath, `${email}.json`);
    const adminIdentityPath = path.join(walletPath, 'admin.json');

    // 1. Kiểm tra ví đã tồn tại chưa
    if (fs.existsSync(userIdentityPath)) {
        throw new Error(`Định danh cho ${email} đã tồn tại trong wallet`);
    }

    // 2. Lấy danh tính Admin để thực hiện Register
    if (!fs.existsSync(adminIdentityPath)) {
        throw new Error('Chưa có Admin CA để thực hiện đăng ký. Hãy chạy enrollAdmin()');
    }

    const adminIdentity = JSON.parse(fs.readFileSync(adminIdentityPath, 'utf8'));
    
    // Tái tạo đối tượng Admin từ file thay vì dùng wallet.getProviderRegistry()
    const provider = FabricCAServices.newCryptoSuite();
    const adminUser = new User('admin');
    const privateKeyObj = await provider.importKey(adminIdentity.credentials.privateKey, { ephemeral: true });
    await adminUser.setEnrollment(privateKeyObj, adminIdentity.credentials.certificate, adminIdentity.mspId);

    // 3. Thực hiện Register (Tạo secret trên Fabric CA)
    const secret = await ca.register({
        affiliation: 'org1.department1',
        enrollmentID: email,
        role: role // 'client' cho student, 'admin' cho university
    }, adminUser);

    // 4. Thực hiện Enroll (Lấy chứng thư X.509 về)
    const enrollment = await ca.enroll({
        enrollmentID: email,
        enrollmentSecret: secret
    });

    const x509Identity = {
        credentials: {
            certificate: enrollment.certificate,
            privateKey: enrollment.key.toBytes(),
        },
        mspId: 'Org1MSP',
        type: 'X.509',
    };

    // 5. Lưu vào Wallet Off-chain
    fs.writeFileSync(userIdentityPath, JSON.stringify(x509Identity, null, 2));

    // Trả về Certificate để lưu vào MongoDB đối soát
    return enrollment.certificate;
};