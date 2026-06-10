import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { Source } from "@/lib/types";

export type SourceRecord = Prisma.SourceGetPayload<object>;

export function toDomainSource(source: SourceRecord): Source {
  return {
    id: source.id,
    title: source.title,
    url: source.url,
    fetchedAt: source.fetchedAt.toISOString(),
    content: source.content,
    isOfficial: source.isOfficial,
  };
}

export async function createSource(reportId: string, source: Source): Promise<Source> {
  const db = getPrismaClient();
  await db.$transaction([
    db.source.create({
      data: {
        id: source.id,
        reportId,
        title: source.title,
        url: source.url,
        fetchedAt: new Date(source.fetchedAt),
        content: source.content,
        isOfficial: source.isOfficial,
      },
    }),
    db.report.update({ where: { id: reportId }, data: { status: "IN_PROGRESS" } }),
  ]);
  return source;
}
