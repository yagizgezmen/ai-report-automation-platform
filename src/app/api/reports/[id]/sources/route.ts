import { NextResponse } from "next/server";
import { collectSource } from "@/lib/source-service";
import { addSource, getReport } from "@/lib/store";
import { sourceSchema } from "@/lib/validation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!getReport(id)) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const { url } = sourceSchema.parse(await request.json());
    const source = await collectSource(url);
    addSource(id, source);
    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not fetch source." }, { status: 400 });
  }
}
