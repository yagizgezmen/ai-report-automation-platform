import { NextResponse } from "next/server";
import { chatAboutSection } from "@/lib/ai-service";
import { getReport } from "@/lib/store";
import { chatSchema } from "@/lib/validation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const report = getReport(id);
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const input = chatSchema.parse(await request.json());
    const section = report.sections.find((item) => item.id === input.sectionId);
    if (!section) return NextResponse.json({ error: "Section not found." }, { status: 404 });
    return NextResponse.json(await chatAboutSection(report, section, input.message));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Assistant request failed." }, { status: 400 });
  }
}
