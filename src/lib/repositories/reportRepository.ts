import {
  Prisma,
  ReportStatus as PrismaReportStatus,
} from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import {
  sectionCreateData,
  toDomainSection,
  updateSections,
} from "@/lib/repositories/sectionRepository";
import { toDomainSource } from "@/lib/repositories/sourceRepository";
import { toDomainDocument } from "@/lib/repositories/documentRepository";
import { createTemplateSections } from "@/lib/templates";
import { CreateReportInput, Report, ReportStatus } from "@/lib/types";

const reportStatusToDb: Record<ReportStatus, PrismaReportStatus> = {
  Draft: "DRAFT",
  "In Progress": "IN_PROGRESS",
  "Needs Review": "NEEDS_REVIEW",
  Completed: "COMPLETED",
};

const reportStatusFromDb: Record<PrismaReportStatus, ReportStatus> = {
  DRAFT: "Draft",
  IN_PROGRESS: "In Progress",
  NEEDS_REVIEW: "Needs Review",
  COMPLETED: "Completed",
};

export const reportInclude = {
  sections: { include: { sourceLinks: true }, orderBy: { position: "asc" as const } },
  sources: true,
  documents: { include: { chunks: { orderBy: { position: "asc" as const } } } },
} satisfies Prisma.ReportInclude;

type ReportRecord = Prisma.ReportGetPayload<{ include: typeof reportInclude }>;

function toDomainReport(record: ReportRecord): Report {
  return {
    id: record.id,
    reportType: record.reportType,
    projectName: record.projectName,
    location: [record.city, record.district, record.neighborhood].filter(Boolean).join(" / "),
    parcelInfo: record.parcelInfo || "",
    manualNotes: record.manualNotes || "",
    outputLanguage: record.outputLanguage,
    allowWebResearch: record.allowWebResearch,
    desiredLength: record.desiredLength,
    status: reportStatusFromDb[record.status],
    sections: record.sections.map(toDomainSection),
    sources: record.sources.map(toDomainSource),
    documents: record.documents.map(toDomainDocument),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function findAllReports(): Promise<Report[]> {
  const records = await getPrismaClient().report.findMany({
    include: reportInclude,
    orderBy: { updatedAt: "desc" },
  });
  return records.map(toDomainReport);
}

export async function findReportById(id: string): Promise<Report | undefined> {
  const record = await getPrismaClient().report.findUnique({
    where: { id },
    include: reportInclude,
  });
  return record ? toDomainReport(record) : undefined;
}

export async function createPersistedReport(input: CreateReportInput): Promise<Report> {
  const record = await getPrismaClient().report.create({
    data: {
      reportType: input.reportType,
      projectName: input.projectName,
      city: input.city,
      district: input.district || null,
      neighborhood: input.neighborhood || null,
      parcelInfo: input.parcelInfo || null,
      manualNotes: input.manualNotes || null,
      outputLanguage: input.outputLanguage,
      allowWebResearch: input.allowWebResearch,
      desiredLength: input.desiredLength,
      sections: {
        create: createTemplateSections().map(sectionCreateData),
      },
    },
    include: reportInclude,
  });
  return toDomainReport(record);
}

export async function savePersistedReport(report: Report): Promise<Report> {
  const db = getPrismaClient();
  await db.$transaction(async (tx) => {
    await tx.report.update({
      where: { id: report.id },
      data: {
        projectName: report.projectName,
        parcelInfo: report.parcelInfo || null,
        manualNotes: report.manualNotes || null,
        status: reportStatusToDb[report.status],
        outputLanguage: report.outputLanguage,
        allowWebResearch: report.allowWebResearch,
        desiredLength: report.desiredLength,
      },
    });
    await updateSections(tx, report.sections);
  });

  const saved = await findReportById(report.id);
  if (!saved) throw new Error("Report could not be reloaded after saving.");
  return saved;
}
