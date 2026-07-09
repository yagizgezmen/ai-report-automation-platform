import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { generateSection } from "@/lib/ai-service";
import { addSource, completeGenerationJob, createGenerationJob, getReport, getReportType, saveReport } from "@/lib/store";
import { generationSchema } from "@/lib/validation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let jobId: string | undefined;
  try {
    const { id } = await context.params;
    const report = await getReport(id);
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const input = generationSchema.parse(await request.json());
    const section = report.sections.find((item) => item.id === input.sectionId);
    if (!section) return NextResponse.json({ error: "Section not found." }, { status: 404 });
    const sectionIndex = report.sections.findIndex((item) => item.id === section.id);
    let sectionAiPrompt = "";
    if (report.reportTypeId) {
      const template = await getReportType(report.reportTypeId);
      if (template) {
        const matchingSection = template.sections.find((templateSection) => templateSection.title === section.title)
          || template.sections.filter((templateSection) => templateSection.isEnabled)[sectionIndex];
        if (matchingSection && !matchingSection.isEnabled) {
          return NextResponse.json({ error: "Section is disabled in the selected report template." }, { status: 400 });
        }
        sectionAiPrompt = matchingSection?.aiPrompt || "";
      }
    }
    jobId = await createGenerationJob(report.id, section.id);
    const result = await generateSection(report, section, input.instruction, sectionAiPrompt);
    const persistedSources = await Promise.all(result.discoveredSources.map((source) => addSource(report.id, source)));
    const discoveredSources = persistedSources.filter((source): source is NonNullable<typeof source> => Boolean(source));
    const hasMissingData = result.missingWarnings.some((warning) =>
      /(add|missing|not yet|required|eksik|henüz|ekleyin|gerekli)/i.test(warning),
    ) || (section.sourceRequired && result.sourceIds.length === 0);
    const needsReview = result.unsupportedClaims.length > 0 || hasMissingData;
    Object.assign(section, result, { reviewStatus: needsReview ? "Needs review" : "Generated" });
    report.sources = [...report.sources, ...discoveredSources.filter((source) => !report.sources.some((item) => item.url === source.url))];
    report.status = needsReview ? "Needs Review" : "In Progress";
    await saveReport(report);
    await completeGenerationJob(jobId);
    return NextResponse.json({ section, reportStatus: report.status, discoveredSources });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    if (jobId) await completeGenerationJob(jobId, message).catch(() => undefined);
    return apiErrorResponse(error, "Generation failed.", 400);
  }
}
