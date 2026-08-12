import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { editSectionWithAssistant } from "@/lib/ai-service";
import { resolveTemplateSectionConfig } from "@/lib/generation-runtime";
import { addChatMessage, getReport, getReportType, saveReport } from "@/lib/store";
import { requireSessionUsername } from "@/lib/session";
import { chatSchema } from "@/lib/validation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const username = await requireSessionUsername();
    const { id } = await context.params;
    const body = await request.json();
    const input = chatSchema.parse(body);
    const report = await getReport(id, username);
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const section = report.sections.find((item) => item.id === input.sectionId);
    if (!section) return NextResponse.json({ error: "Section not found." }, { status: 404 });
    let template;
    if (report.reportTypeId) {
      template = await getReportType(report.reportTypeId);
      if (template) {
        const matchingSection = resolveTemplateSectionConfig(template, report, section);
        if (matchingSection && !matchingSection.isEnabled) {
          return NextResponse.json({ error: "Section is disabled in the selected report template." }, { status: 400 });
        }
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
        template,
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
      await saveReport(report, username);
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
