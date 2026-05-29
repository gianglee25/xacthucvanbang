import { NextResponse } from "next/server";
import { executeTransaction } from "@/lib/fabric/fabricService";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const certUUID = searchParams.get('certUUID');
    
    if (!certUUID) {
      return NextResponse.json({ success: false, error: "Thiếu certUUID" }, { status: 400 });
    }

    const result = await executeTransaction("evaluate", "GetCertificateHistory", certUUID);
    const history = Array.isArray(result.result) ? result.result : JSON.parse(result.result || '[]');

    return NextResponse.json({ success: true, history });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
