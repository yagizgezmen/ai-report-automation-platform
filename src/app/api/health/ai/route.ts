import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/provider-factory";

export async function GET() {
  const provider = getAIProvider();
  const status = await provider.healthCheck();
  return NextResponse.json(status, { status: status.reachable ? 200 : 503 });
}