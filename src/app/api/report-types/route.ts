import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { addReportType, listReportTypes } from "@/lib/store";
import { createReportTypeSchema } from "@/lib/validation";

function normalizeSections(
  sections: Array<{ id?: string; title?: string; description?: string; sortOrder?: number }>,
) {
  return sections
    .filter((section) => section.title || section.description)
    .map((section, index) => ({
      id: section.id || "",
      title: section.title || "",
      description: section.description || "",
      sortOrder: section.sortOrder ?? index,
    }));
}

function normalizeSources(
  sources: Array<{ id?: string; name?: string; url?: string; description?: string }>,
) {
  return sources
    .filter((source) => source.name || source.url || source.description)
    .map((source) => ({
      id: source.id || "",
      name: source.name || "",
      url: source.url || "",
      description: source.description || "",
    }));
}

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
    const sections = normalizeSections(input.sections);
    const sources = normalizeSources(input.sources);
    return NextResponse.json(
      await addReportType(
        input.name,
        input.description,
        sections,
        sources,
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Could not create report template.", 400);
  }
}
