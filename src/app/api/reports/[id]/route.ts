import { NextResponse } from "next/server";
import { getReport, saveReport } from "@/lib/store";
import { Report } from "@/lib/types";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const report = getReport(id);
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  return NextResponse.json(report);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const report = getReport(id);
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  const body = await request.json() as Partial<Report>;
  const allowed: (keyof Report)[] = ["projectName", "manualNotes", "status", "sections"];
  for (const key of allowed) {
    if (body[key] !== undefined) Object.assign(report, { [key]: body[key] });
  }
  return NextResponse.json(saveReport(report));
}
