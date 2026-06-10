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
    return NextResponse.json(await addReportType(input.name, input.description), { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Could not create report template.", 400);
  }
}
