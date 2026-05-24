'use strict';

import { Contract } from 'fabric-contract-api';

export class CertContract extends Contract {

    async InitLedger(ctx) {
        console.info('============= TLU DIPLOMA SYSTEM INITIALIZED =============');
        return JSON.stringify({ success: true, message: 'Ledger Initialized Successfully!' });
    }

    async IssueCertificate(ctx, certUUID, certDataJSON) {
        const exists = await this.CertificateExists(ctx, certUUID);
        if (exists) {
            throw new Error(`[VALIDATION ERROR] Certificate with UUID ${certUUID} already exists!`);
        }

        const certData = JSON.parse(certDataJSON);

        // Check for SHA-256 Hash (64 characters)
        if (!certData.certHash || certData.certHash === 'N/A' || certData.certHash.length !== 64) {
            throw new Error('[VALIDATION ERROR] Transaction rejected: SHA-256 certHash (64 chars) is required.');
        }

        const certificate = {
            docType: 'certificate',
            certUUID: certUUID,
            studentName: certData.studentName,
            major: certData.major,
            dateOfIssuing: certData.dateOfIssuing,
            certHash: certData.certHash, 
            issuerId: ctx.clientIdentity.getID() 
        };

        await ctx.stub.putState(certUUID, Buffer.from(JSON.stringify(certificate)));
        
        return JSON.stringify({ 
            success: true, 
            message: `Certificate hash for ${certUUID} has been recorded on-chain` 
        });
    }

    async QueryCertificate(ctx, certUUID) {
        const certAsBytes = await ctx.stub.getState(certUUID);
        if (!certAsBytes || certAsBytes.length === 0) {
            throw new Error(`[NOT FOUND] Certificate ${certUUID} does not exist!`);
        }
        return certAsBytes.toString('utf8');
    }

    async CertificateExists(ctx, certUUID) {
        const certAsBytes = await ctx.stub.getState(certUUID);
        return certAsBytes && certAsBytes.length > 0;
    }

    async DeleteCertificate(ctx, certUUID) {
        const exists = await this.CertificateExists(ctx, certUUID);
        if (!exists) {
            throw new Error(`[NOT FOUND] Certificate ${certUUID} does not exist!`);
        }
        await ctx.stub.deleteState(certUUID);
        return JSON.stringify({ success: true, message: `Certificate ${certUUID} deleted from world state` });
    }

    async QueryAllCertificates(ctx) {
        const allResults = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        
        try {
            let result = await iterator.next();
            while (!result.done) {
                if (result.value && result.value.value) {
                    try {
                        const strValue = result.value.value.toString('utf8');
                        const record = JSON.parse(strValue);
                        
                        if (record.docType === 'certificate') {
                            allResults.push({
                                Key: result.value.key,
                                Record: record
                            });
                        }
                    } catch (parseErr) {
                        console.warn(`Warning: Could not parse record for key ${result.value.key}`);
                    }
                }
                result = await iterator.next();
            }
        } finally {
            await iterator.close();
        }
        
        return JSON.stringify(allResults);
    }
}

export const contracts = [CertContract];