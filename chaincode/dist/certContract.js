"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertContract = void 0;
const fabric_contract_api_1 = require("fabric-contract-api");
const crypto = __importStar(require("crypto"));
let CertContract = class CertContract extends fabric_contract_api_1.Contract {
    async InitLedger(ctx) {
        console.info("============= TLU DIPLOMA SYSTEM INITIALIZED =============");
        return JSON.stringify({
            success: true,
            message: "Ledger Initialized Successfully!",
        });
    }
    async IssueCertificate(ctx, certUUID, mssv, studentName, major, gpaStr, classification, issueDate, soHieu, // Tham số 8
    soVaoSo, // Tham số 9
    className, // Tham số 10
    namTotNghiep) {
        // 1. KIỂM TRA TỒN TẠI
        const exists = await this.CertificateExists(ctx, certUUID);
        if (exists) {
            throw new Error(`[LỖI BLOCKCHAIN] Văn bằng với UUID ${certUUID} đã tồn tại!`);
        }
        // 2. VALIDATION NGHIỆP VỤ
        const gpa = parseFloat(gpaStr);
        if (isNaN(gpa) || gpa < 0 || gpa > 4.0) {
            throw new Error(`[LỖI BLOCKCHAIN] GPA không hợp lệ: ${gpaStr}.`);
        }
        if (!studentName ||
            studentName.trim() === "" ||
            !mssv ||
            mssv.trim() === "" ||
            !soHieu ||
            soHieu.trim() === "") {
            throw new Error("[LỖI BLOCKCHAIN] Dữ liệu bắt buộc (Tên, MSSV, Số hiệu VB) không được để trống.");
        }
        // 3. TỰ TÍNH TOÁN MÃ BĂM (ON-CHAIN HASHING - ĐÃ BAO GỒM 11 THAM SỐ)
        const safeGpa = gpa.toFixed(2);
        const rawData = `${certUUID}|${mssv}|${studentName}|${major}|${safeGpa}|${classification}|${issueDate}|${soHieu}|${soVaoSo}|${className}|${namTotNghiep}`;
        const blockchainHash = crypto
            .createHash("sha256")
            .update(rawData)
            .digest("hex");
        // 4. LƯU TRỮ VÀO SỔ CÁI (BỔ SUNG CÁC TRƯỜNG MỚI)
        const certificate = {
            docType: "certificate",
            certUUID: certUUID,
            mssv: mssv,
            studentName: studentName,
            major: major,
            gpa: safeGpa,
            grade: classification,
            issueDate: issueDate,
            soHieu: soHieu,
            soVaoSo: soVaoSo,
            className: className,
            namTotNghiep: namTotNghiep,
            certHash: blockchainHash,
            issuerId: ctx.clientIdentity.getID(),
        };
        const certData = Buffer.from(JSON.stringify(certificate));
        // Chuyển đổi Buffer thành Uint8Array để tương thích với yêu cầu của Fabric API mới
        await ctx.stub.putState(certUUID, new Uint8Array(certData.buffer, certData.byteOffset, certData.byteLength));
        return JSON.stringify({
            success: true,
            txId: ctx.stub.getTxID(),
            hash: blockchainHash,
            message: `Certificate recorded on-chain for MSSV: ${mssv}`,
        });
    }
    async QueryCertificate(ctx, certUUID) {
        const certAsBytes = await ctx.stub.getState(certUUID);
        if (!certAsBytes || certAsBytes.length === 0) {
            throw new Error(`[NOT FOUND] Certificate ${certUUID} does not exist!`);
        }
        return certAsBytes.toString();
    }
    async CertificateExists(ctx, certUUID) {
        const certAsBytes = await ctx.stub.getState(certUUID);
        return certAsBytes && certAsBytes.length > 0;
    }
    async QueryAllCertificates(ctx) {
        const allResults = [];
        const iterator = await ctx.stub.getStateByRange("", "");
        try {
            let result = await iterator.next();
            while (!result.done) {
                if (result.value && result.value.value) {
                    const strValue = result.value.value.toString();
                    try {
                        const record = JSON.parse(strValue);
                        if (record.docType === "certificate") {
                            allResults.push({ Key: result.value.key, Record: record });
                        }
                    }
                    catch (err) {
                        /* Bỏ qua log lỗi để tránh nhiễu */
                    }
                }
                result = await iterator.next();
            }
        }
        finally {
            await iterator.close();
        }
        return JSON.stringify(allResults);
    }
};
__decorate([
    (0, fabric_contract_api_1.Transaction)(),
    (0, fabric_contract_api_1.Returns)("string"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fabric_contract_api_1.Context]),
    __metadata("design:returntype", Promise)
], CertContract.prototype, "InitLedger", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(),
    (0, fabric_contract_api_1.Returns)("string"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fabric_contract_api_1.Context, String, String, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], CertContract.prototype, "IssueCertificate", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)("string"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fabric_contract_api_1.Context, String]),
    __metadata("design:returntype", Promise)
], CertContract.prototype, "QueryCertificate", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)("boolean"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fabric_contract_api_1.Context, String]),
    __metadata("design:returntype", Promise)
], CertContract.prototype, "CertificateExists", null);
__decorate([
    (0, fabric_contract_api_1.Transaction)(false),
    (0, fabric_contract_api_1.Returns)("string"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fabric_contract_api_1.Context]),
    __metadata("design:returntype", Promise)
], CertContract.prototype, "QueryAllCertificates", null);
CertContract = __decorate([
    (0, fabric_contract_api_1.Info)({
        title: "CertContract",
        description: "Smart contract cho hệ thống cấp phát văn bằng TLU - Đã bổ sung MSSV",
    })
], CertContract);
exports.CertContract = CertContract;
//# sourceMappingURL=certContract.js.map