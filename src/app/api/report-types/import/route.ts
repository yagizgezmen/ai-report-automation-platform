import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { importTemplateFromDocument } from "@/lib/template-import";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A document file is required." }, { status: 400 });
    }

    return NextResponse.json(await importTemplateFromDocument(file), { status: 200 });
  } catch (error) {
    return apiErrorResponse(error, "Could not import report template from document.", 400);
  }
}