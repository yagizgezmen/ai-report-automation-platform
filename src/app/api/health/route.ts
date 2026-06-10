import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/store";

export function GET() {
  return NextResponse.json({
    status: "ok",
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    persistenceMode: isDemoMode() ? "demo" : "postgresql",
    timestamp: new Date().toISOString(),
  });
}
