import { NextResponse } from "next/server";
import { extractDocument } from "@/lib/document-service";
import { addDocument, getReport } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!getReport(id)) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "A file is required." }, { status: 400 });
    const document = await extractDocument(file);
    addDocument(id, document);
    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not process document." }, { status: 400 });
  }
}
