import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/store";
import { persistenceMode } from "@/lib/prisma";

export function GET() {
  return NextResponse.json({
    status: "ok",
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    persistenceMode: isDemoMode() ? "demo" : "postgresql",
    runtimeMode: persistenceMode,
    demoModeEnv: process.env.DEMO_MODE ?? "undefined",
    databaseUrlPresent: Boolean(process.env.DATABASE_URL),
    timestamp: new Date().toISOString(),
  });
}
