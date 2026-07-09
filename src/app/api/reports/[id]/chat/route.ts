import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { chatAboutSection } from "@/lib/ai-service";
import { addChatMessage, addSource, getReport, saveReport } from "@/lib/store";
import { chatSchema } from "@/lib/validation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const report = await getReport(id);
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const input = chatSchema.parse(await request.json());
    const section = report.sections.find((item) => item.id === input.sectionId);
    if (!section) return NextResponse.json({ error: "Section not found." }, { status: 404 });
    await addChatMessage(report.id, section.id, "user", input.message);
    const result = await chatAboutSection(report, section, input.message, input.action);
    const persistedSources = await Promise.all(result.discoveredSources.map((source) => addSource(report.id, source)));
    const discoveredSources = persistedSources.filter((source): source is Exclude<typeof source, undefined> => Boolean(source));
    const mergedSources = [...report.sources, ...discoveredSources.filter((source) => !report.sources.some((item) => item.url === source.url))];
    let updatedSection = section;
    if (input.action === "rewrite" && result.proposedContent) {
      updatedSection = {
        ...section,
        content: result.proposedContent,
        reviewStatus: "Needs review",
      };
      report.sections = report.sections.map((item) => item.id === section.id ? updatedSection : item);
      report.sources = mergedSources;
      report.status = "In Progress";
      await saveReport(report);
    }
    await addChatMessage(report.id, section.id, "assistant", result.reply || JSON.stringify(result));
    return NextResponse.json({
      ...result,
      discoveredSources,
      section: input.action === "rewrite" ? updatedSection : undefined,
    });
  } catch (error) {
    return apiErrorResponse(error, "Assistant request failed.", 400);
  }
}
