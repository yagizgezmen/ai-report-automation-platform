import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import {
  listReportTypeSources,
  saveReportTypeSources,
} from "@/lib/store";
import { reportTypeSourcesSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const reportType = new URL(request.url).searchParams.get("reportType")?.trim();
    if (!reportType) {
      return NextResponse.json({ error: "Report type is required." }, { status: 400 });
    }
    return NextResponse.json(await listReportTypeSources(reportType));
  } catch (error) {
    return apiErrorResponse(error, "Could not load report sources.");
  }
}

export async function PUT(request: Request) {
  try {
    const input = reportTypeSourcesSchema.parse(await request.json());
    return NextResponse.json(await saveReportTypeSources(input.reportType, input.urls));
  } catch (error) {
    return apiErrorResponse(error, "Could not save report sources.", 400);
  }
}
