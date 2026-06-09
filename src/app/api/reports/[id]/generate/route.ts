import { NextResponse } from "next/server";
import { generateSection } from "@/lib/ai-service";
import { getReport, saveReport } from "@/lib/store";
import { generationSchema } from "@/lib/validation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const report = getReport(id);
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const input = generationSchema.parse(await request.json());
    const section = report.sections.find((item) => item.id === input.sectionId);
    if (!section) return NextResponse.json({ error: "Section not found." }, { status: 404 });
    const result = await generateSection(report, section, input.instruction);
    Object.assign(section, result, { reviewStatus: result.unsupportedClaims.length ? "Needs review" : "Generated" });
    report.status = result.unsupportedClaims.length ? "Needs Review" : "In Progress";
    saveReport(report);
    return NextResponse.json({ section, reportStatus: report.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Generation failed." }, { status: 400 });
  }
}
