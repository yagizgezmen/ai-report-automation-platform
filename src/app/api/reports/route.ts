import { NextResponse } from "next/server";
import { collectSource } from "@/lib/source-service";
import { createReport, listReports, saveReport } from "@/lib/store";
import { createReportSchema } from "@/lib/validation";

export async function GET() {
  return NextResponse.json(listReports());
}

export async function POST(request: Request) {
  try {
    const input = createReportSchema.parse(await request.json());
    const report = createReport(input);
    const results = await Promise.allSettled(input.sourceUrls.map(collectSource));
    report.sources = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
    if (report.sources.length) report.status = "In Progress";
    saveReport(report);
    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid report data.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
