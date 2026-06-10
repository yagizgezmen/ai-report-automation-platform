import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { extractDocument } from "@/lib/document-service";
import { addDocument, getReport } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!await getReport(id)) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "A file is required." }, { status: 400 });
    const document = await extractDocument(file);
    const saved = await addDocument(id, document);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Could not process document.", 400);
  }
}
