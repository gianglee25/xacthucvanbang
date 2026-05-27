import FabricCAServices from 'fabric-ca-client';
import * as fs from 'fs';
import * as path from 'path';

export async function enrollAdminOrg2() {
    try {
        console.log("--- Bắt đầu Enroll Admin Org2 (Phân hiệu TP.HCM) ---");

        // 1. Đọc connection profile Org2
        const ccpPath = path.resolve(process.cwd(), 'src', 'config', 'connection-org2.json');
        if (!fs.existsSync(ccpPath)) {
            throw new Error(`Không tìm thấy file cấu hình tại: ${ccpPath}`);
        }
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // 2. Đọc TLS cert của CA Org2
        const caCertPath = path.resolve(
            process.cwd(),
            'blockchain-network/organizations/peerOrganizations/org2.example.com/ca/ca.org2.example.com-cert.pem'
        );
        if (!fs.existsSync(caCertPath)) {
            throw new Error(`Không tìm thấy CA cert Org2 tại: ${caCertPath}`);
        }
        const caTLSCACerts = fs.readFileSync(caCertPath);

        // 3. Khởi tạo CA Client Org2 (port 8054)
        const caInfo = ccp.certificateAuthorities['ca.org2.example.com'];
        const ca = new FabricCAServices(
            caInfo.url,
            { trustedRoots: caTLSCACerts, verify: false },
            caInfo.caName
        );

        // 4. Tạo wallet nếu chưa có
        const walletPath = path.join(process.cwd(), 'wallet');
        if (!fs.existsSync(walletPath)) {
            fs.mkdirSync(walletPath, { recursive: true });
        }

        const adminIdentityPath = path.join(walletPath, 'admin-org2.json');

        // 5. Bỏ qua nếu đã enroll
        if (fs.existsSync(adminIdentityPath)) {
            console.log('✅ Admin Org2 đã tồn tại trong wallet. Không cần enroll lại.');
            return;
        }

        // 6. Enroll admin Org2
        const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });

        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org2MSP',
            type: 'X.509',
        };

        fs.writeFileSync(adminIdentityPath, JSON.stringify(x509Identity, null, 2));
        console.log(`🎉 THÀNH CÔNG: Đã lưu chứng chỉ Org2 vào: ${adminIdentityPath}`);

    } catch (error) {
        console.error(`❌ THẤT BẠI: ${error}`);
        process.exit(1);
    }
}

enrollAdminOrg2();
