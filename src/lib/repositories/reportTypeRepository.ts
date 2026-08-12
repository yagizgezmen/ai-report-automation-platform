import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { DEFAULT_REPORT_TEMPLATES } from "@/lib/report-types";
import { ReportType } from "@/lib/types";

const reportTypeInclude = {
  sections: { orderBy: { sortOrder: "asc" as const } },
  sources: { orderBy: { name: "asc" as const } },
} satisfies Prisma.ReportTypeInclude;

type ReportTypeRecord = Prisma.ReportTypeGetPayload<{ include: typeof reportTypeInclude }>;

function toDomainReportType(record: ReportTypeRecord): ReportType {
  return {
    id: record.id,
    name: record.name,
    description: record.description || "",
    defaultLanguage: record.defaultLanguage || "Turkish",
    enableWebResearch: record.enableWebResearch,
    defaultAiPrompt: record.defaultAiPrompt || "",
    creativityLevel: record.creativityLevel,
    requireCitations: record.requireCitations,
    reportTone: record.reportTone || "Technical",
    documentFormat: record.documentFormat || "DOCX",
    sections: record.sections.map((section) => ({
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
    })),
    sources: record.sources.map((source) => ({
      id: source.id,
      name: source.name,
      url: source.url,
      description: source.description || "",
    })),
  };
}

export async function ensureDefaultReportTypes() {
  const db = getPrismaClient();
  await db.$transaction(async (tx) => {
    for (const template of DEFAULT_REPORT_TEMPLATES) {
      const existing = await tx.reportType.findUnique({
        where: { name: template.name },
        include: reportTypeInclude,
      });
      if (!existing) {
        await tx.reportType.create({
          data: {
            name: template.name,
            description: template.description,
            sections: {
              create: template.sections.map((section, index) => ({
                title: section.title,
                description: section.description,
                sortOrder: index,
                requiredInputs: [],
                sourceRequired: false,
                aiPrompt: "",
                isRequired: true,
                isEnabled: true,
              })),
            },
            sources: {
              create: template.sources.map((source) => ({
                name: source.name,
                url: source.url,
                description: source.description,
                priority: "MEDIUM",
              })),
            },
          },
        });
        continue;
      }

      if (!existing.sections.length) {
        await tx.reportTypeSection.createMany({
          data: template.sections.map((section, index) => ({
            reportTypeId: existing.id,
            title: section.title,
            description: section.description,
            sortOrder: index,
            requiredInputs: [],
            sourceRequired: false,
            aiPrompt: "",
            isRequired: true,
            isEnabled: true,
          })),
        });
      }

      if (!existing.sources.length) {
        await tx.reportTypeSource.createMany({
          data: template.sources.map((source) => ({
            reportTypeId: existing.id,
            name: source.name,
            url: source.url,
            description: source.description,
            priority: "MEDIUM",
          })),
        });
      }
    }
  });
}

export async function findAllReportTypes(): Promise<ReportType[]> {
  await ensureDefaultReportTypes();
  const records = await getPrismaClient().reportType.findMany({
    include: reportTypeInclude,
    orderBy: { name: "asc" },
  });
  return records.map(toDomainReportType);
}

export async function findReportTypeById(id: string): Promise<ReportType | undefined> {
  await ensureDefaultReportTypes();
  const record = await getPrismaClient().reportType.findUnique({
    where: { id },
    include: reportTypeInclude,
  });
  return record ? toDomainReportType(record) : undefined;
}

export async function createReportType(
  name: string,
  description: string,
  configuration: Pick<
    ReportType,
    "defaultLanguage" | "enableWebResearch" | "defaultAiPrompt" | "creativityLevel" | "requireCitations" | "reportTone" | "documentFormat"
  >,
) {
  const record = await getPrismaClient().reportType.create({
    data: {
      name,
      description,
      defaultLanguage: configuration.defaultLanguage || "Turkish",
      enableWebResearch: configuration.enableWebResearch ?? true,
      defaultAiPrompt: configuration.defaultAiPrompt || "",
      creativityLevel: configuration.creativityLevel ?? 20,
      requireCitations: configuration.requireCitations ?? true,
      reportTone: configuration.reportTone || "Technical",
      documentFormat: configuration.documentFormat || "DOCX",
    },
    include: reportTypeInclude,
  });
  return toDomainReportType(record);
}

export async function createFullReportType(template: Omit<ReportType, "id">) {
  const record = await getPrismaClient().reportType.create({
    data: {
      name: template.name,
      description: template.description || null,
      defaultLanguage: template.defaultLanguage || "Turkish",
      enableWebResearch: template.enableWebResearch ?? true,
      defaultAiPrompt: template.defaultAiPrompt || "",
      creativityLevel: template.creativityLevel ?? 20,
      requireCitations: template.requireCitations ?? true,
      reportTone: template.reportTone || "Technical",
      documentFormat: template.documentFormat || "DOCX",
      sections: {
        create: template.sections.map((section, index) => ({
          title: section.title,
          description: section.description,
          sortOrder: section.sortOrder ?? index,
          requiredInputs: section.requiredInputs,
          sourceRequired: section.sourceRequired,
          aiPrompt: section.aiPrompt || "",
          isRequired: section.isRequired ?? true,
          isEnabled: section.isEnabled ?? true,
        })),
      },
      sources: {
        create: template.sources.map((source) => ({
          name: source.name,
          url: source.url,
          description: source.description || null,
          priority: "MEDIUM",
        })),
      },
    },
    include: reportTypeInclude,
  });
  return toDomainReportType(record);
}

export async function saveReportType(template: ReportType) {
  const db = getPrismaClient();
  await db.$transaction(async (tx) => {
    await tx.reportType.update({
      where: { id: template.id },
      data: {
        name: template.name,
        description: template.description || null,
        defaultLanguage: template.defaultLanguage || "Turkish",
        enableWebResearch: template.enableWebResearch ?? true,
        defaultAiPrompt: template.defaultAiPrompt || "",
        creativityLevel: template.creativityLevel ?? 20,
        requireCitations: template.requireCitations ?? true,
        reportTone: template.reportTone || "Technical",
        documentFormat: template.documentFormat || "DOCX",
      },
    });

    const existingSections = await tx.reportTypeSection.findMany({
      where: { reportTypeId: template.id },
      select: { id: true },
    });
    const nextSectionIds = new Set(template.sections.filter((section) => section.id).map((section) => section.id));
    const removableSectionIds = existingSections.map((section) => section.id).filter((id) => !nextSectionIds.has(id));
    if (removableSectionIds.length) {
      await tx.reportTypeSection.deleteMany({ where: { id: { in: removableSectionIds } } });
    }

    for (const [index, section] of template.sections.entries()) {
      if (existingSections.some((item) => item.id === section.id)) {
        await tx.reportTypeSection.update({
          where: { id: section.id },
          data: {
            title: section.title,
            description: section.description,
            sortOrder: index,
            requiredInputs: section.requiredInputs,
            sourceRequired: section.sourceRequired,
            aiPrompt: section.aiPrompt || "",
            isRequired: section.isRequired ?? true,
            isEnabled: section.isEnabled ?? true,
          },
        });
      } else {
        await tx.reportTypeSection.create({
          data: {
            reportTypeId: template.id,
            title: section.title,
            description: section.description,
            sortOrder: index,
            requiredInputs: section.requiredInputs,
            sourceRequired: section.sourceRequired,
            aiPrompt: section.aiPrompt || "",
            isRequired: section.isRequired ?? true,
            isEnabled: section.isEnabled ?? true,
          },
        });
      }
    }

    const existingSources = await tx.reportTypeSource.findMany({
      where: { reportTypeId: template.id },
      select: { id: true },
    });
    const nextSourceIds = new Set(template.sources.filter((source) => source.id).map((source) => source.id));
    const removableSourceIds = existingSources.map((source) => source.id).filter((id) => !nextSourceIds.has(id));
    if (removableSourceIds.length) {
      await tx.reportTypeSource.deleteMany({ where: { id: { in: removableSourceIds } } });
    }

    for (const source of template.sources) {
      if (existingSources.some((item) => item.id === source.id)) {
        await tx.reportTypeSource.update({
          where: { id: source.id },
          data: {
            name: source.name,
            url: source.url,
            description: source.description || null,
            priority: "MEDIUM",
          },
        });
      } else {
        await tx.reportTypeSource.create({
          data: {
            reportTypeId: template.id,
            name: source.name,
            url: source.url,
            description: source.description || null,
            priority: "MEDIUM",
          },
        });
      }
    }
  });

  const saved = await findReportTypeById(template.id);
  if (!saved) throw new Error("Report template could not be reloaded after saving.");
  return saved;
}

export async function deleteReportType(id: string) {
  await getPrismaClient().reportType.delete({ where: { id } });
}
