import { describe, expect, it } from "vitest";
import { extractStructuredStringField } from "@/lib/ai/json";
import { demoGeneration, reportLanguageInstruction } from "@/lib/ai-service";
import { buildCitationInstruction, clampCreativityLevel, creativityLevelToTemperature, resolveGenerationRuntimeConfig, sortSourcesForGeneration, filterValidSourceIds } from "@/lib/generation-runtime";
import { Report, ReportSection, ReportType, Source } from "@/lib/types";

const section: ReportSection = {
  id: "section",
  title: "Executive Summary",
  description: "Summary",
  requiredInputs: [],
  sourceRequired: false,
  isRequired: true,
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

function template(overrides: Partial<ReportType> = {}): ReportType {
  return {
    id: "template-1",
    name: "Template",
    description: "Template description",
    defaultLanguage: "German",
    enableWebResearch: true,
    defaultAiPrompt: "Use template instructions.",
    creativityLevel: 80,
    requireCitations: true,
    reportTone: "Legal",
    documentFormat: "DOCX",
    sections: [{
      id: "section-config-1",
      title: "Executive Summary",
      description: "Summary",
      sortOrder: 0,
      requiredInputs: [],
      sourceRequired: false,
      aiPrompt: "Include a formal legal summary.",
      isRequired: true,
      isEnabled: true,
    }],
    sources: [
      { id: "source-template-1", name: "High", url: "https://high.example.com", description: "", priority: "HIGH" },
      { id: "source-template-2", name: "Low", url: "https://low.example.com", description: "", priority: "LOW" },
    ],
    ...overrides,
  };
}

function source(input: Partial<Source> & Pick<Source, "id" | "title" | "url" | "content">): Source {
  return {
    fetchedAt: new Date().toISOString(),
    isOfficial: false,
    origin: "configured",
    ...input,
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

  it("uses report language before template default language", () => {
    const config = resolveGenerationRuntimeConfig(report("English"), section, template());
    expect(config.language).toBe("English");
  });

  it("uses template language when the report language is blank", () => {
    const blankLanguageReport = { ...report("English"), outputLanguage: "" };
    const config = resolveGenerationRuntimeConfig(blankLanguageReport, section, template());
    expect(config.language).toBe("German");
  });

  it("clamps creativity safely and maps to temperature", () => {
    expect(clampCreativityLevel(150)).toBe(100);
    expect(clampCreativityLevel(-5)).toBe(0);
    expect(creativityLevelToTemperature(50)).toBe(0.5);
  });

  it("includes citation requirement in runtime config helpers", () => {
    const config = resolveGenerationRuntimeConfig(report("English"), section, template({ requireCitations: true }));
    expect(config.requireCitations).toBe(true);
    expect(buildCitationInstruction(true)).toContain("Do not invent source identifiers");
  });

  it("uses the saved report web research setting as runtime truth", () => {
    const config = resolveGenerationRuntimeConfig({ ...report("English"), allowWebResearch: false }, section, template({ enableWebResearch: true }));
    expect(config.allowWebResearch).toBe(false);
  });

  it("sorts sources by template priority before lower-priority sources", () => {
    const config = resolveGenerationRuntimeConfig(report("English"), section, template());
    const sorted = sortSourcesForGeneration([
      source({ id: "low", title: "Low priority source", url: "https://low.example.com", content: "Summary evidence" }),
      source({ id: "high", title: "High priority source", url: "https://high.example.com", content: "Summary evidence" }),
    ], "summary evidence", config);
    expect(sorted[0].id).toBe("high");
  });

  it("filters invalid model-generated source ids", () => {
    const sources = [
      source({ id: "valid-1", title: "Valid", url: "https://valid.example.com", content: "evidence" }),
    ];
    expect(filterValidSourceIds(["valid-1", "missing", "valid-1"], sources)).toEqual(["valid-1"]);
  });

  it("uses safe defaults for legacy configuration", () => {
    const legacyTemplate = template({
      defaultLanguage: "",
      defaultAiPrompt: "",
      creativityLevel: Number.NaN,
      requireCitations: true,
      reportTone: "",
    });
    const legacyReport = { ...report("English"), outputLanguage: "", allowWebResearch: false, desiredLength: Number.NaN as unknown as number };
    const config = resolveGenerationRuntimeConfig(legacyReport, section, legacyTemplate);
    expect(config.language).toBe("Turkish");
    expect(config.tone).toBe("Technical");
    expect(config.creativityLevel).toBe(20);
    expect(config.desiredLength).toBeNull();
  });

  it("recovers structured content text from malformed partial JSON", () => {
    const raw = '{"content":"GLOBAL-RUNTIME-MARKER\\nSECTION-RUNTIME-MARKER\\nMersin idari baglami';
    expect(extractStructuredStringField(raw, "content")).toBe("GLOBAL-RUNTIME-MARKER\nSECTION-RUNTIME-MARKER\nMersin idari baglami");
  });
});
