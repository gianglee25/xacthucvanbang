import { Context, Contract } from 'fabric-contract-api';
export declare class CertContract extends Contract {
    InitLedger(ctx: Context): Promise<string>;
    IssueCertificate(ctx: Context, certUUID: string, mssv: string, studentName: string, major: string, gpaStr: string, classification: string, issueDate: string): Promise<string>;
    QueryCertificate(ctx: Context, certUUID: string): Promise<string>;
    CertificateExists(ctx: Context, certUUID: string): Promise<boolean>;
    QueryAllCertificates(ctx: Context): Promise<string>;
}
