import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { collectSource } from "@/lib/source-service";
import {
  addSource,
  createReport,
  getReportType,
  getReport,
  listReports,
} from "@/lib/store";
import { requireSessionUsername } from "@/lib/session";
import { createReportSchema } from "@/lib/validation";

export async function GET() {
  try {
    const username = await requireSessionUsername();
    return NextResponse.json(await listReports(username));
  } catch (error) {
    return apiErrorResponse(error, "Could not load reports.");
  }
}

export async function POST(request: Request) {
  try {
    const username = await requireSessionUsername();
    const payload = await request.json();
    const input = createReportSchema.parse(payload);
    const reportType = input.reportTypeId ? await getReportType(input.reportTypeId) : undefined;
    const normalizedInput = {
      ...input,
      outputLanguage: typeof payload.outputLanguage === "string" && payload.outputLanguage.trim()
        ? input.outputLanguage
        : (reportType?.defaultLanguage || input.outputLanguage),
      allowWebResearch: typeof payload.allowWebResearch === "boolean"
        ? input.allowWebResearch
        : (reportType?.enableWebResearch ?? input.allowWebResearch),
    };
    const report = await createReport(normalizedInput, username);
    const results = await Promise.allSettled(
      (reportType?.sources || []).map((source) => collectSource(source.url, {
        origin: "configured",
        searchQuery: reportType?.name || normalizedInput.reportTypeName || "Custom Report",
      })),
    );
    const sources = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
    await Promise.all(sources.map((source) => addSource(report.id, source, username)));
    return NextResponse.json(await getReport(report.id, username), { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Could not create report.", 400);
  }
}
