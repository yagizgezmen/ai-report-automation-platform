import { describe, expect, it } from "vitest";
import { buildWebResearchQueries, researchWeb } from "@/lib/services/webResearchService";
import { Report, ReportSection } from "@/lib/types";

const section: ReportSection = {
  id: "section-1",
  title: "Legal / Administrative Background",
  description: "Administrative context",
  requiredInputs: [],
  sourceRequired: true,
  content: "",
  reviewStatus: "Not started",
  confidence: "Low",
  unsupportedClaims: [],
  missingWarnings: [],
  sourceIds: [],
};

function report(allowWebResearch: boolean): Report {
  return {
    id: "report-1",
    reportType: "Planning & Development Report",
    projectName: "Sample Project",
    location: "Mersin / Akdeniz / Karaduvar",
    parcelInfo: "Block 123 Parcel 45",
    manualNotes: "",
    outputLanguage: "English",
    allowWebResearch,
    desiredLength: 60,
    status: "Draft",
    sections: [section],
    sources: [],
    documents: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("web research service", () => {
  it("builds search queries from report and section context", () => {
    const queries = buildWebResearchQueries(report(true), section);
    expect(queries[0]).toContain("Planning & Development Report");
    expect(queries.join(" ")).toContain("Mersin");
    expect(queries.join(" ")).toContain("Akdeniz");
    expect(queries.join(" ")).toContain("Karaduvar");
    expect(queries.join(" ")).toContain("Block 123 Parcel 45");
    expect(queries.join(" ")).toContain("Legal / Administrative Background");
  });

  it("does not research when web research is disabled", async () => {
    await expect(researchWeb({ report: report(false), section })).resolves.toEqual([]);
  });
});
