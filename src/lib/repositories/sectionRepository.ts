import {
  Prisma,
  ReviewStatus as PrismaReviewStatus,
} from "@prisma/client";
import { ReportSection, ReviewStatus } from "@/lib/types";

export type TransactionClient = Prisma.TransactionClient;

const reviewStatusToDb: Record<ReviewStatus, PrismaReviewStatus> = {
  "Not started": "NOT_STARTED",
  Generated: "GENERATED",
  "Needs review": "NEEDS_REVIEW",
  Approved: "APPROVED",
};

const reviewStatusFromDb: Record<PrismaReviewStatus, ReviewStatus> = {
  NOT_STARTED: "Not started",
  GENERATED: "Generated",
  NEEDS_REVIEW: "Needs review",
  APPROVED: "Approved",
};

export type SectionRecord = Prisma.ReportSectionGetPayload<{
  include: { sourceLinks: true };
}>;

function stringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function toDomainSection(section: SectionRecord): ReportSection {
  return {
    id: section.id,
    title: section.title,
    description: section.description,
    requiredInputs: stringArray(section.requiredInputs),
    sourceRequired: section.sourceRequired,
    content: section.content,
    reviewStatus: reviewStatusFromDb[section.reviewStatus],
    confidence: section.confidence === "High" || section.confidence === "Medium" ? section.confidence : "Low",
    unsupportedClaims: stringArray(section.unsupportedClaims),
    missingWarnings: stringArray(section.missingWarnings),
    sourceIds: section.sourceLinks.map((link) => link.sourceId),
  };
}

export function sectionCreateData(section: ReportSection, position: number) {
  return {
    position,
    title: section.title,
    description: section.description,
    requiredInputs: section.requiredInputs,
    sourceRequired: section.sourceRequired,
    content: section.content,
    reviewStatus: reviewStatusToDb[section.reviewStatus],
    confidence: section.confidence,
    unsupportedClaims: section.unsupportedClaims,
    missingWarnings: section.missingWarnings,
  } satisfies Prisma.ReportSectionCreateWithoutReportInput;
}

export async function updateSections(
  tx: TransactionClient,
  sections: ReportSection[],
) {
  for (const [position, section] of sections.entries()) {
    await tx.reportSection.update({
      where: { id: section.id },
      data: {
        position,
        title: section.title,
        description: section.description,
        requiredInputs: section.requiredInputs,
        sourceRequired: section.sourceRequired,
        content: section.content,
        reviewStatus: reviewStatusToDb[section.reviewStatus],
        confidence: section.confidence,
        unsupportedClaims: section.unsupportedClaims,
        missingWarnings: section.missingWarnings,
        sourceLinks: {
          deleteMany: {},
          create: section.sourceIds.map((sourceId) => ({ sourceId })),
        },
      },
    });
  }
}
