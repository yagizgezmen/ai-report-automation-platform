import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { getReport, saveReport } from "@/lib/store";
import { Report } from "@/lib/types";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const report = await getReport(id);
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    return NextResponse.json(report);
  } catch (error) {
    return apiErrorResponse(error, "Could not load report.");
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const report = await getReport(id);
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const body = await request.json() as Partial<Report>;
    const allowed: (keyof Report)[] = ["projectName", "manualNotes", "status", "sections"];
    for (const key of allowed) {
      if (body[key] !== undefined) Object.assign(report, { [key]: body[key] });
    }
    return NextResponse.json(await saveReport(report));
  } catch (error) {
    return apiErrorResponse(error, "Could not save report.", 400);
  }
}
