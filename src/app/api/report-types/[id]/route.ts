import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { getReportType, removeReportType, updateReportType } from "@/lib/store";
import { updateReportTypeSchema } from "@/lib/validation";

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
    return NextResponse.json(await updateReportType({
      id: input.id,
      name: input.name,
      description: input.description,
      sections: input.sections.map((section, index) => ({
        id: section.id || "",
        title: section.title,
        description: section.description,
        sortOrder: section.sortOrder ?? index,
      })),
      sources: input.sources.map((source) => ({
        id: source.id || "",
        name: source.name,
        url: source.url,
        description: source.description || "",
      })),
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
