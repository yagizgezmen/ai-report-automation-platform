import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { chatAboutSection } from "@/lib/ai-service";
import { addChatMessage, addSource, getReport } from "@/lib/store";
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
    const result = await chatAboutSection(report, section, input.message);
    const persistedSources = await Promise.all(result.discoveredSources.map((source) => addSource(report.id, source)));
    const discoveredSources = persistedSources.filter((source): source is Exclude<typeof source, undefined> => Boolean(source));
    await addChatMessage(report.id, section.id, "assistant", result.reply || JSON.stringify(result));
    return NextResponse.json({ ...result, discoveredSources });
  } catch (error) {
    return apiErrorResponse(error, "Assistant request failed.", 400);
  }
}
