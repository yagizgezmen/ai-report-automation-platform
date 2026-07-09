import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { addReportType, listReportTypes } from "@/lib/store";
import { createReportTypeSchema } from "@/lib/validation";

export async function GET() {
  try {
    return NextResponse.json(await listReportTypes());
  } catch (error) {
    return apiErrorResponse(error, "Could not load report templates.");
  }
}

export async function POST(request: Request) {
  try {
    const input = createReportTypeSchema.parse(await request.json());
    return NextResponse.json(
      await addReportType(
        input.name,
        input.description,
        {
          defaultLanguage: input.defaultLanguage,
          enableWebResearch: input.enableWebResearch,
          defaultAiPrompt: input.defaultAiPrompt,
          creativityLevel: input.creativityLevel,
          requireCitations: input.requireCitations,
          reportTone: input.reportTone,
          documentFormat: input.documentFormat,
        },
        input.sections.map((section, index) => ({
          id: section.id || "",
          title: section.title,
          description: section.description,
          sortOrder: section.sortOrder ?? index,
          aiPrompt: section.aiPrompt || "",
          isRequired: section.isRequired ?? true,
          isEnabled: section.isEnabled ?? true,
        })),
        input.sources.map((source) => ({
          id: source.id || "",
          name: source.name,
          url: source.url,
          description: source.description || "",
        })),
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Could not create report template.", 400);
  }
}
