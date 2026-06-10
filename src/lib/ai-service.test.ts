import { describe, expect, it } from "vitest";
import { demoGeneration, reportLanguageInstruction } from "@/lib/ai-service";
import { Report, ReportSection } from "@/lib/types";

const section: ReportSection = {
  id: "section",
  title: "Executive Summary",
  description: "Summary",
  requiredInputs: [],
  sourceRequired: false,
  content: "",
  reviewStatus: "Not started",
  confidence: "Low",
  unsupportedClaims: [],
  missingWarnings: [],
  sourceIds: [],
};

function report(outputLanguage: string): Report {
  return {
    id: "report",
    reportType: "Planning & Development Report",
    projectName: "Test Project",
    location: "Istanbul",
    parcelInfo: "Block 1 Parcel 2",
    manualNotes: "",
    outputLanguage,
    allowWebResearch: false,
    desiredLength: 60,
    status: "Draft",
    sections: [section],
    sources: [],
    documents: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("AI output language", () => {
  it("creates Turkish demo content for Turkish reports", () => {
    const result = demoGeneration(report("Turkish"), section, "");
    expect(result.content).toContain("Yönetici Özeti");
    expect(result.content).toContain("Planlama ve Geliştirme Raporu");
    expect(result.content).not.toContain("Executive Summary");
    expect(result.content).toContain("projesi için hazırlanmıştır");
    expect(result.missingWarnings[0]).toContain("kaynak");
  });

  it("creates English demo content for English reports", () => {
    const result = demoGeneration(report("English"), section, "");
    expect(result.content).toContain("has been prepared");
    expect(result.missingWarnings[0]).toContain("source");
  });

  it("builds a strict language instruction", () => {
    expect(reportLanguageInstruction("Turkish")).toContain("only in the report language: Turkish");
  });
});
