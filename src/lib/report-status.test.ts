import { describe, expect, it } from "vitest";
import { deriveReportStatus } from "@/lib/report-status";
import { ReportSection } from "@/lib/types";

function makeSection(reviewStatus: ReportSection["reviewStatus"]): ReportSection {
  return {
    id: `section-${reviewStatus}`,
    title: "Section",
    description: "Description",
    requiredInputs: [],
    sourceRequired: false,
    isRequired: true,
    content: "",
    reviewStatus,
    confidence: "High",
    unsupportedClaims: [],
    missingWarnings: [],
    sourceIds: [],
  };
}

describe("deriveReportStatus", () => {
  it("returns Completed when all sections are generated or approved", () => {
    expect(deriveReportStatus([
      makeSection("Generated"),
      makeSection("Approved"),
      makeSection("Generated"),
    ])).toBe("Completed");
  });

  it("returns Needs Review when any section needs review", () => {
    expect(deriveReportStatus([
      makeSection("Generated"),
      makeSection("Needs review"),
    ])).toBe("Needs Review");
  });
});