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
    origin:
      source.origin === "AI_DISCOVERED"
        ? "ai-discovered"
        : source.origin === "USER_PROVIDED"
          ? "manual"
          : "configured",
    searchQuery: source.searchQuery || undefined,
  };
}

export async function createSource(reportId: string, source: Source): Promise<Source> {
  const db = getPrismaClient();
  const existing = await db.source.findFirst({
    where: { reportId, url: source.url },
  });

  const origin = source.origin === "ai-discovered"
    ? "AI_DISCOVERED"
    : source.origin === "manual"
      ? "USER_PROVIDED"
      : "CONFIGURED";

  if (existing) {
    const updated = await db.source.update({
      where: { id: existing.id },
      data: {
        title: source.title,
        fetchedAt: new Date(source.fetchedAt),
        content: source.content,
        isOfficial: source.isOfficial,
        origin,
        searchQuery: source.searchQuery || null,
      },
    });
    return toDomainSource(updated);
  }

  const created = await db.$transaction(async (tx) => {
    const record = await tx.source.create({
      data: {
        id: source.id,
        reportId,
        title: source.title,
        url: source.url,
        fetchedAt: new Date(source.fetchedAt),
        content: source.content,
        isOfficial: source.isOfficial,
        origin,
        searchQuery: source.searchQuery || null,
      },
    });
    await tx.report.update({ where: { id: reportId }, data: { status: "IN_PROGRESS" } });
    return record;
  });

  return toDomainSource(created);
}
