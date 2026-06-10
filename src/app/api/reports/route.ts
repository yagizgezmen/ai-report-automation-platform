import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { collectSource } from "@/lib/source-service";
import {
  addSource,
  createReport,
  getReport,
  listReports,
  listReportTypeSources,
} from "@/lib/store";
import { createReportSchema } from "@/lib/validation";

export async function GET() {
  try {
    return NextResponse.json(await listReports());
  } catch (error) {
    return apiErrorResponse(error, "Could not load reports.");
  }
}

export async function POST(request: Request) {
  try {
    const input = createReportSchema.parse(await request.json());
    const report = await createReport(input);
    const configuredSources = await listReportTypeSources(input.reportType);
    const results = await Promise.allSettled(configuredSources.map(({ url }) => collectSource(url)));
    const sources = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
    await Promise.all(sources.map((source) => addSource(report.id, source)));
    return NextResponse.json(await getReport(report.id), { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Could not create report.", 400);
  }
}
