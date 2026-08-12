import { NextResponse } from "next/server";
import { persistenceModeLabel } from "@/lib/prisma";
import { isDemoMode } from "@/lib/store";

export function GET() {
  return NextResponse.json({
    status: "ok",
    persistenceMode: isDemoMode() ? "demo" : "postgresql",
    persistenceLabel: persistenceModeLabel(),
    timestamp: new Date().toISOString(),
  });
}
