import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/provider-factory";
import { persistenceModeLabel } from "@/lib/prisma";
import { isDemoMode } from "@/lib/store";

export async function GET() {
  const provider = getAIProvider();
  return NextResponse.json({
    status: "ok",
    persistenceMode: isDemoMode() ? "demo" : "postgresql",
    persistenceLabel: persistenceModeLabel(),
    aiProvider: provider.name,
    aiConfigured: provider.configured,
    aiModel: provider.model,
    timestamp: new Date().toISOString(),
  });
}
