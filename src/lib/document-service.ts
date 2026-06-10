import { randomUUID } from "crypto";
import mammoth from "mammoth";
import pdf from "pdf-parse";
import { chunkText } from "@/lib/chunking";
import { UploadedDocument } from "@/lib/types";

const allowed = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"]);

export async function extractDocument(file: File): Promise<UploadedDocument> {
  if (!allowed.has(file.type)) throw new Error("Only PDF, DOCX, and TXT files are supported.");
  if (file.size > 15 * 1024 * 1024) throw new Error("File size must be under 15 MB.");
  const buffer = Buffer.from(await file.arrayBuffer());
  let extractedText = "";
  if (file.type === "application/pdf") extractedText = (await pdf(buffer)).text;
  else if (file.type.includes("wordprocessingml")) extractedText = (await mammoth.extractRawText({ buffer })).value;
  else extractedText = buffer.toString("utf8");
  extractedText = extractedText.replace(/\u0000/g, "").trim();
  if (!extractedText) throw new Error("No readable text could be extracted.");
  const chunks = chunkText(extractedText);
  return {
    id: randomUUID(),
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    extractedText,
    chunks: chunks.length,
    chunkContents: chunks,
  };
}
