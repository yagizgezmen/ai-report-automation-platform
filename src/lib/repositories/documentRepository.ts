import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { UploadedDocument } from "@/lib/types";

export type DocumentRecord = Prisma.UploadedDocumentGetPayload<{
  include: { chunks: true };
}>;

export function toDomainDocument(document: DocumentRecord): UploadedDocument {
  return {
    id: document.id,
    fileName: document.fileName,
    mimeType: document.mimeType,
    size: document.size,
    extractedText: document.extractedText,
    chunks: document.chunks.length,
  };
}

export async function createDocument(
  reportId: string,
  document: UploadedDocument,
): Promise<UploadedDocument> {
  const db = getPrismaClient();
  const chunks = document.chunkContents || [];
  await db.$transaction([
    db.uploadedDocument.create({
      data: {
        id: document.id,
        reportId,
        fileName: document.fileName,
        mimeType: document.mimeType,
        size: document.size,
        extractedText: document.extractedText,
        chunks: {
          create: chunks.map((content, position) => ({ position, content })),
        },
      },
    }),
    db.report.update({ where: { id: reportId }, data: { status: "IN_PROGRESS" } }),
  ]);
  return { ...document, chunks: chunks.length, chunkContents: undefined };
}
