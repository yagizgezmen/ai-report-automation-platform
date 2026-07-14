import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { editSectionWithAssistant } from "@/lib/ai-service";
import { addChatMessage, getReport, getReportType, saveReport } from "@/lib/store";
import { chatSchema } from "@/lib/validation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const input = chatSchema.parse(body);
    const report = await getReport(id);
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const section = report.sections.find((item) => item.id === input.sectionId);
    if (!section) return NextResponse.json({ error: "Section not found." }, { status: 404 });
    let templatePrompt = "";
    let sectionPrompt = "";
    if (report.reportTypeId) {
      const template = await getReportType(report.reportTypeId);
      if (template) {
        templatePrompt = template.defaultAiPrompt || "";
        const matchingSection = template.sections.find((item) => item.title === section.title)
          || template.sections.filter((item) => item.isEnabled)[report.sections.findIndex((item) => item.id === section.id)];
        sectionPrompt = matchingSection?.aiPrompt || "";
      }
    }
    const currentContent = typeof body.currentContent === "string" && body.currentContent.trim()
      ? body.currentContent
      : section.content;
    await addChatMessage(report.id, section.id, "user", input.message);

    let result;
    try {
      result = await editSectionWithAssistant(
        report,
        section,
        input.message,
        input.actionType,
        currentContent,
        templatePrompt,
        sectionPrompt,
      );
    } catch (aiError: unknown) {
      const is413 = aiError instanceof Error && (
        aiError.message.includes("413") ||
        aiError.message.includes("too large") ||
        aiError.message.includes("Request body")
      );
      const errorMsg = is413
        ? (report.outputLanguage.toLowerCase().includes("türk") || report.outputLanguage.toLowerCase().includes("turk")
          ? "İstek boyutu sınırı aştı. Lütfen daha az kaynak ekleyerek tekrar deneyin."
          : "Request size exceeded the model limit. Please reduce sources and try again.")
        : (aiError instanceof Error ? aiError.message : "AI request failed.");
      await addChatMessage(report.id, section.id, "assistant", errorMsg);
      return NextResponse.json({ updatedSection: null, assistantMessage: errorMsg, actionType: input.actionType });
    }

    let updatedSection = result.updatedSection;
    if (updatedSection) {
      updatedSection = { ...updatedSection, content: updatedSection.content.trim() };
      report.sections = report.sections.map((item) => item.id === section.id ? updatedSection! : item);
      report.status = "In Progress";
      await saveReport(report);
    }
    await addChatMessage(report.id, section.id, "assistant", result.assistantMessage);
    return NextResponse.json({
      updatedSection,
      assistantMessage: result.assistantMessage,
      actionType: result.actionType,
    });
  } catch (error) {
    return apiErrorResponse(error, "Assistant request failed.", 400);
  }
}
