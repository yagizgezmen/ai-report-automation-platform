import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { getReportType, removeReportType, updateReportType } from "@/lib/store";
import { updateReportTypeSchema } from "@/lib/validation";

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

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const template = await getReportType(id);
    if (!template) return NextResponse.json({ error: "Report template not found." }, { status: 404 });
    return NextResponse.json(template);
  } catch (error) {
    return apiErrorResponse(error, "Could not load report template.");
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = updateReportTypeSchema.parse({ ...(await request.json()), id });
    const sections = normalizeSections(input.sections);
    const sources = normalizeSources(input.sources);
    return NextResponse.json(await updateReportType({
      id: input.id,
      name: input.name,
      description: input.description,
      sections,
      sources,
    }));
  } catch (error) {
    return apiErrorResponse(error, "Could not save report template.", 400);
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await removeReportType(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "Could not delete report template.", 400);
  }
}
