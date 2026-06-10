import { getPrismaClient } from "@/lib/prisma";
import { ReportTypeSource } from "@/lib/types";

export async function findReportTypeSources(reportType: string): Promise<ReportTypeSource[]> {
  return getPrismaClient().reportTypeSource.findMany({
    where: { reportType },
    orderBy: { createdAt: "asc" },
  });
}

export async function replaceReportTypeSources(
  reportType: string,
  urls: string[],
): Promise<ReportTypeSource[]> {
  const db = getPrismaClient();
  const uniqueUrls = [...new Set(urls)];

  await db.$transaction(async (tx) => {
    await tx.reportTypeSource.deleteMany({ where: { reportType } });
    if (uniqueUrls.length) {
      await tx.reportTypeSource.createMany({
        data: uniqueUrls.map((url) => ({ reportType, url })),
      });
    }
  });

  return findReportTypeSources(reportType);
}
