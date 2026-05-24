import { Context, Contract } from "fabric-contract-api";
export declare class CertContract extends Contract {
    InitLedger(ctx: Context): Promise<string>;
    IssueCertificate(ctx: Context, certUUID: string, mssv: string, studentName: string, major: string, gpaStr: string, classification: string, issueDate: string, soHieu: string, // Tham số 8
    soVaoSo: string, // Tham số 9
    className: string, // Tham số 10
    namTotNghiep: string): Promise<string>;
    QueryCertificate(ctx: Context, certUUID: string): Promise<string>;
    CertificateExists(ctx: Context, certUUID: string): Promise<boolean>;
    QueryAllCertificates(ctx: Context): Promise<string>;
}
