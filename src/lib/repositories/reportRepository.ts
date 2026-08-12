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
import { ensureWorkspaceUser } from "@/lib/repositories/userRepository";
import { deriveReportStatus, syncReportStatus } from "@/lib/report-status";
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
  return syncReportStatus({
    id: record.id,
    reportTypeId: record.reportTypeId || undefined,
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
  });
}

export async function findAllReports(username: string): Promise<Report[]> {
  const user = await ensureWorkspaceUser(username);
  const records = await getPrismaClient().report.findMany({
    where: { userId: user.id },
    include: reportInclude,
    orderBy: { updatedAt: "desc" },
  });
  return records.map(toDomainReport);
}

export async function findReportById(id: string, username: string): Promise<Report | undefined> {
  const user = await ensureWorkspaceUser(username);
  const record = await getPrismaClient().report.findFirst({
    where: { id, userId: user.id },
    include: reportInclude,
  });
  return record ? toDomainReport(record) : undefined;
}

export async function createPersistedReport(input: CreateReportInput, username: string): Promise<Report> {
  const user = await ensureWorkspaceUser(username);
  const reportType = input.reportTypeId
    ? await getPrismaClient().reportType.findUnique({
        where: { id: input.reportTypeId },
        include: { sections: { orderBy: { sortOrder: "asc" } } },
      })
    : null;

  const reportTypeName = reportType?.name || input.reportTypeName || "Custom Report";
  const sectionConfigs = reportType?.sections.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    sortOrder: section.sortOrder,
    requiredInputs: Array.isArray(section.requiredInputs)
      ? section.requiredInputs.filter((item): item is string => typeof item === "string")
      : [],
    sourceRequired: section.sourceRequired,
    aiPrompt: section.aiPrompt || "",
    isRequired: section.isRequired,
    isEnabled: section.isEnabled,
  }));

  const record = await getPrismaClient().report.create({
    data: {
      userId: user.id,
      reportTypeId: reportType?.id || null,
      reportType: reportTypeName,
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
        create: createTemplateSections(sectionConfigs).map(sectionCreateData),
      },
    },
    include: reportInclude,
  });
  return toDomainReport(record);
}

export async function savePersistedReport(report: Report, username: string): Promise<Report> {
  const db = getPrismaClient();
  const user = await ensureWorkspaceUser(username);
  const normalizedReport = syncReportStatus(report);
  await db.$transaction(async (tx) => {
    const ownedReport = await tx.report.findFirst({ where: { id: normalizedReport.id, userId: user.id }, select: { id: true } });
    if (!ownedReport) throw new Error("Report not found.");
    await tx.report.update({
      where: { id: normalizedReport.id },
      data: {
        projectName: normalizedReport.projectName,
        reportTypeId: normalizedReport.reportTypeId || null,
        parcelInfo: normalizedReport.parcelInfo || null,
        manualNotes: normalizedReport.manualNotes || null,
        status: reportStatusToDb[deriveReportStatus(normalizedReport.sections)],
        outputLanguage: normalizedReport.outputLanguage,
        allowWebResearch: normalizedReport.allowWebResearch,
        desiredLength: normalizedReport.desiredLength,
      },
    });
    await updateSections(tx, normalizedReport.sections);
  });

  const saved = await findReportById(normalizedReport.id, username);
  if (!saved) throw new Error("Report could not be reloaded after saving.");
  return saved;
}
