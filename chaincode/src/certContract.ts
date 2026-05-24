import { Context, Contract, Info, Returns, Transaction } from 'fabric-contract-api';
import * as crypto from 'crypto';

@Info({ title: 'CertContract', description: 'Smart contract cho hệ thống cấp phát văn bằng TLU - Đã bổ sung MSSV' })
export class CertContract extends Contract {

    @Transaction()
    @Returns('string')
    public async InitLedger(ctx: Context): Promise<string> {
        console.info('============= TLU DIPLOMA SYSTEM INITIALIZED =============');
        return JSON.stringify({ success: true, message: 'Ledger Initialized Successfully!' });
    }

    @Transaction()
    @Returns('string')
    public async IssueCertificate(
        ctx: Context, 
        certUUID: string, 
        mssv: string, 
        studentName: string, 
        major: string, 
        gpaStr: string, 
        classification: string, 
        issueDate: string
    ): Promise<string> {
        
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

        if (!studentName || studentName.trim() === '' || !mssv || mssv.trim() === '') {
            throw new Error('[LỖI BLOCKCHAIN] Tên sinh viên hoặc MSSV không được để trống.');
        }

        // 3. TỰ TÍNH TOÁN MÃ BĂM (ON-CHAIN HASHING)
        const safeGpa = gpa.toFixed(2);
        const rawData = `${certUUID}|${mssv}|${studentName}|${major}|${safeGpa}|${classification}`;
        const blockchainHash = crypto.createHash('sha256').update(rawData).digest('hex');

        // 4. LƯU TRỮ VÀO SỔ CÁI (BỔ SUNG TRƯỜNG MSSV)
        const certificate = {
            docType: 'certificate',
            certUUID: certUUID,
            mssv: mssv,            // Đã bổ sung MSSV vào đây
            studentName: studentName,
            major: major,
            dateOfIssuing: issueDate,
            certHash: blockchainHash, 
            issuerId: ctx.clientIdentity.getID() 
        };

        await ctx.stub.putState(certUUID, Buffer.from(JSON.stringify(certificate)));
        
        return JSON.stringify({ 
            success: true, 
            txId: ctx.stub.getTxID(), 
            hash: blockchainHash,     
            message: `Certificate recorded on-chain for MSSV: ${mssv}` 
        });
    }

    @Transaction(false)
    @Returns('string')
    public async QueryCertificate(ctx: Context, certUUID: string): Promise<string> {
        const certAsBytes = await ctx.stub.getState(certUUID);
        if (!certAsBytes || certAsBytes.length === 0) {
            throw new Error(`[NOT FOUND] Certificate ${certUUID} does not exist!`);
        }
        return certAsBytes.toString();
    }

    @Transaction(false)
    @Returns('boolean')
    public async CertificateExists(ctx: Context, certUUID: string): Promise<boolean> {
        const certAsBytes = await ctx.stub.getState(certUUID);
        return certAsBytes && certAsBytes.length > 0;
    }

    @Transaction(false)
    @Returns('string')
    public async QueryAllCertificates(ctx: Context): Promise<string> {
        const allResults: any[] = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        
        try {
            let result = await iterator.next();
            while (!result.done) {
                if (result.value && result.value.value) {
                    const strValue = result.value.value.toString();
                    try {
                        const record = JSON.parse(strValue);
                        if (record.docType === 'certificate') {
                            allResults.push({ Key: result.value.key, Record: record });
                        }
                    } catch (err) { /* Bỏ qua log lỗi để tránh nhiễu */ }
                }
                result = await iterator.next();
            }
        } finally {
            await iterator.close();
        }
        return JSON.stringify(allResults);
    }
}