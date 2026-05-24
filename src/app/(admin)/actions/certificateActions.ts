'use server'

import { connectDB } from '@/lib/db/connect';
import { Certificate } from '@/lib/db/models/Certificate';
import { createDiploma } from '@/lib/fabric/fabricService';
import * as crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// This replaces the old `createDiploma` manual invoke and the Excel import logic per item.
export async function issueSingleCertificate(formData: FormData) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== 'UNIVERSITY') {
            throw new Error('Unauthorized. Chỉ cán bộ ĐHTL mới có quyền cấp phát.');
        }

        await connectDB();

        // 1. Extract Data from FormData
        const mssv = formData.get('mssv') as string;
        const fullName = formData.get('fullName') as string;
        const major = formData.get('major') as string;
        const issueDate = formData.get('issueDate') as string;
        const certUUID = formData.get('certUUID') as string; 
        
        // Validation Gate Prep
        if (!mssv || !fullName || !certUUID) {
             throw new Error('Thiếu dữ liệu bắt buộc');
        }

        // 2. Generate the SHA-256 Hash for the Validation Gate
        const rawDataString = `${certUUID}-${mssv}-${fullName}-${major}-${issueDate}`;
        const certHash = crypto.createHash('sha256').update(rawDataString).digest('hex');

        // 3. Save to MongoDB (Hybrid Storage - Off-chain)
        const newDbCert = new Certificate({
            uuid: certUUID,
            mssv,
            fullName,
            major,
            issueDate,
            certHash,
            status: 'PENDING',
            // pdfUrl would be handled by an S3/Cloudinary upload logic here
        });
        
        await newDbCert.save();

        // 4. Submit to Blockchain (Fabric Gateway)
        // We pass the certHash to satisfy the Chaincode Validation Gate[cite: 1]
        const fabricResult = await createDiploma(certUUID, fullName, major, issueDate, certHash);

        // 5. Update DB Status upon success
        newDbCert.status = 'ISSUED';
        newDbCert.txId = fabricResult?.txId || 'FABRIC_TX_SUCCESS';
        await newDbCert.save();

        // Refresh the UI cache
        revalidatePath('/dashboard');

        return { success: true, message: 'Cấp phát văn bằng thành công' };

    } catch (error: any) {
        console.error('Error issuing certificate:', error);
        return { success: false, error: error.message };
    }
}