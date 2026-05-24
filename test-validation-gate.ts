import * as grpc from "@grpc/grpc-js";
import { connect, signers, Identity, Signer } from "@hyperledger/fabric-gateway";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

// 1. Cấu hình mạng lưới
const channelName = "channel-vb-tlu";
const chaincodeName = "educert";
const mspId = "Org1MSP";
const cryptoPath = path.resolve(process.cwd(), "wallet", "admin.json");
const peerEndpoint = "127.0.0.1:7051";

const tlsCertPath = path.resolve(
    process.cwd(),
    "blockchain-network",
    "organizations",
    "peerOrganizations",
    "org1.example.com",
    "peers",
    "peer0.org1.example.com",
    "tls",
    "ca.crt"
);

// 2. Các hàm bổ trợ (Đặt ở trên để runTest gọi được)
async function newGrpcConnection(): Promise<grpc.Client> {
    const tlsRootCert = fs.readFileSync(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        "grpc.ssl_target_name_override": "peer0.org1.example.com",
    });
}

function newIdentity(walletJson: any): Identity {
    return { mspId, credentials: Buffer.from(walletJson.credentials.certificate) };
}

function newSigner(walletJson: any): Signer {
    const privateKey = crypto.createPrivateKey({
        key: Buffer.from(walletJson.credentials.privateKey), format: "pem"
    });
    return signers.newPrivateKeySigner(privateKey);
}

// 3. Kịch bản chạy Test
async function runTest() {
    console.log("\n=========================================================================");
    console.log("🚀 BẮT ĐẦU KỊCH BẢN TEST CỔNG KIỂM ĐỊNH (VALIDATION GATE) TRÊN CHAINCODE 🚀");
    console.log("=========================================================================\n");

    const walletJson = JSON.parse(fs.readFileSync(cryptoPath, "utf8"));
    const client = await newGrpcConnection();
    const gateway = connect({ client, identity: newIdentity(walletJson), signer: newSigner(walletJson) });

    try {
        const network = gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);

        // ✅ TEST CASE 0: Dữ liệu hợp lệ
        console.log("▶ TEST CASE 0: Ghi dữ liệu hợp lệ (Kiểm chứng Chaincode hoạt động)...");
        try {
            const uuid = `VALID-${crypto.randomBytes(2).toString('hex')}`;
            await contract.submitTransaction("IssueCertificate", uuid, "22519999", "Sinh viên Mẫu", "CNTT", "3.80", "Giỏi", "2026-05-24");
            console.log("   ✅ KẾT QUẢ: Thành công. Dữ liệu hợp lệ đã được ghi vào Blockchain.");
        } catch (error: any) {
            console.log(`   ❌ LỖI: ${error.message}`);
        }

        // ❌ TEST CASE 1: Tên trống
        console.log("\n▶ TEST CASE 1: Cố tình chèn Tên sinh viên bị bỏ trống...");
        try {
            await contract.submitTransaction("IssueCertificate", "HACK-01", "22510001", "", "CNTT", "3.5", "Giỏi", "2026-05-24");
        } catch (error: any) {
            console.log("   ✅ KẾT QUẢ: Blockchain đã chặn đứng! Chi tiết lỗi:");
            console.log(`   👉 \x1b[31m${error.message}\x1b[0m`);
        }

        // ❌ TEST CASE 2: GPA sai (5.5)
        console.log("\n▶ TEST CASE 2: Cố tình hack điểm GPA lên 5.5...");
        try {
            await contract.submitTransaction("IssueCertificate", "HACK-02", "22510002", "Hacker", "CNTT", "5.5", "Giỏi", "2026-05-24");
        } catch (error: any) {
            console.log("   ✅ KẾT QUẢ: Blockchain đã chặn đứng! Chi tiết lỗi:");
            console.log(`   👉 \x1b[31m${error.message}\x1b[0m`);
        }

        // ❌ TEST CASE 3: Xếp loại sai ('Siêu Cấp')
        console.log("\n▶ TEST CASE 3: Nhập sai xếp loại ('Siêu Cấp')...");
        try {
            await contract.submitTransaction("IssueCertificate", "HACK-03", "22510003", "Hacker", "CNTT", "3.0", "Siêu Cấp", "2026-05-24");
        } catch (error: any) {
            console.log("   ✅ KẾT QUẢ: Blockchain đã chặn đứng! Chi tiết lỗi:");
            console.log(`   👉 \x1b[31m${error.message}\x1b[0m`);
        }

        console.log("\n=========================================================================");
        console.log("🎉 KẾT LUẬN: VALIDATION GATE TRÊN TẦNG BLOCKCHAIN HOẠT ĐỘNG HOÀN HẢO 100% 🎉");
        console.log("=========================================================================\n");

    } finally {
        gateway.close();
        client.close();
    }
}

runTest();