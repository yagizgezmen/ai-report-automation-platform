import { randomUUID } from "crypto";
import { DEFAULT_REPORT_TEMPLATES } from "@/lib/report-types";
import { syncReportStatus } from "@/lib/report-status";
import { createTemplateSections } from "@/lib/templates";
import {
  CreateReportInput,
  Report,
  ReportType,
  Source,
  UploadedDocument,
} from "@/lib/types";

const now = new Date();

const demoReportTypes: ReportType[] = DEFAULT_REPORT_TEMPLATES.map((template, templateIndex) => ({
  id: `demo-report-type-${templateIndex + 1}`,
  name: template.name,
  description: template.description,
  defaultLanguage: "Turkish",
  enableWebResearch: true,
  defaultAiPrompt: "",
  creativityLevel: 20,
  requireCitations: true,
  reportTone: "Technical",
  documentFormat: "DOCX",
  sections: template.sections.map((section, sectionIndex) => ({
    id: `demo-report-type-${templateIndex + 1}-section-${sectionIndex + 1}`,
    title: section.title,
    description: section.description,
    sortOrder: sectionIndex,
    requiredInputs: [],
    sourceRequired: false,
    aiPrompt: "",
    isRequired: true,
    isEnabled: true,
  })),
  sources: template.sources.map((source, sourceIndex) => ({
    id: `demo-report-type-${templateIndex + 1}-source-${sourceIndex + 1}`,
    name: source.name,
    url: source.url,
    description: source.description,
  })),
}));

const sampleTemplate = demoReportTypes[0];
const sampleReport: Report = {
  id: "demo-report",
  reportTypeId: sampleTemplate.id,
  reportType: sampleTemplate.name,
  projectName: "Kadıköy Coastal Planning Assessment",
  location: "Istanbul / Kadıköy / Fenerbahçe",
  parcelInfo: "Block 348, Parcels 12–15",
  manualNotes: "Focus on planning compatibility, transport access, and public realm impact.",
  outputLanguage: "English",
  allowWebResearch: false,
  desiredLength: 65,
  status: "Needs Review",
  sections: createTemplateSections(sampleTemplate.sections).map((section, index) => ({
    ...section,
    id: `demo-section-${index + 1}`,
    content: index === 0
      ? "This report evaluates the planning context and development considerations for the subject properties in Fenerbahçe, Kadıköy. The assessment consolidates project information, official planning material, and company observations into a structured basis for decision-making [S1].\n\nThe available evidence indicates that the site benefits from an established urban setting and access to regional transport connections. Detailed confirmation of current plan notes and parcel-specific restrictions remains necessary before a final development position is adopted [Needs manual review]."
      : index === 1
        ? "The project concerns a planning and development assessment for Block 348, Parcels 12–15 in the Fenerbahçe neighborhood of Kadıköy, Istanbul. The requested scope is to establish the applicable administrative context, summarize source material, and provide a professional company assessment."
        : "",
    reviewStatus: index < 2 ? "Generated" : section.reviewStatus,
    confidence: index === 0 ? "Medium" : index === 1 ? "High" : "Low",
    sourceIds: index === 0 ? ["source-1"] : [],
    missingWarnings: index === 0 ? ["Parcel-specific plan notes require confirmation."] : section.missingWarnings,
    unsupportedClaims: index === 0 ? ["The site benefits from regional transport connections."] : [],
  })),
  sources: [{
    id: "source-1",
    title: "Kadıköy Municipality – Planning Services",
    url: "https://www.kadikoy.bel.tr/",
    fetchedAt: now.toISOString(),
    content: "Official municipality source supplied for planning and administrative context.",
    isOfficial: true,
    origin: "configured",
  }],
  documents: [],
  createdAt: new Date(now.getTime() - 86400000 * 7).toISOString(),
  updatedAt: now.toISOString(),
};

const DEMO_REPORT_OWNER = "admin";

const globalStore = globalThis as unknown as {
  reportStore?: Map<string, Report>;
  reportTypeStore?: Map<string, ReportType>;
  reportOwnerStore?: Map<string, string>;
};
const reports = globalStore.reportStore ?? new Map([[sampleReport.id, sampleReport]]);
const reportTypes = globalStore.reportTypeStore ?? new Map(demoReportTypes.map((item) => [item.id, item]));
const reportOwners = globalStore.reportOwnerStore ?? new Map([[sampleReport.id, DEMO_REPORT_OWNER]]);
globalStore.reportStore = reports;
globalStore.reportTypeStore = reportTypes;
globalStore.reportOwnerStore = reportOwners;

export function listDemoReports(username: string): Report[] {
  return [...reports.entries()]
    .filter(([id]) => reportOwners.get(id) === username)
    .map(([, report]) => syncReportStatus(report))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createDemoReport(input: CreateReportInput, username: string): Report {
  const template = input.reportTypeId ? reportTypes.get(input.reportTypeId) : undefined;
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  const report: Report = {
    id,
    reportTypeId: template?.id,
    reportType: template?.name || input.reportTypeName || "Custom Report",
    projectName: input.projectName,
    location: [input.city, input.district, input.neighborhood].filter(Boolean).join(" / "),
    parcelInfo: input.parcelInfo || "",
    manualNotes: input.manualNotes || "",
    outputLanguage: input.outputLanguage,
    allowWebResearch: input.allowWebResearch,
    desiredLength: input.desiredLength,
    status: "Draft",
    sections: createTemplateSections(template?.sections).map((section) => ({ ...section, id: randomUUID() })),
    sources: [],
    documents: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const normalizedReport = syncReportStatus(report);
  reports.set(id, normalizedReport);
  reportOwners.set(id, username);
  return normalizedReport;
}

export function getDemoReport(id: string, username: string): Report | undefined {
  const report = reportOwners.get(id) === username ? reports.get(id) : undefined;
  return report ? syncReportStatus(report) : undefined;
}

export function saveDemoReport(report: Report, username: string): Report {
  if (reportOwners.get(report.id) !== username) {
    throw new Error("Report not found.");
  }
  const saved = syncReportStatus({ ...report, updatedAt: new Date().toISOString() });
  reports.set(report.id, saved);
  return saved;
}

export function addDemoSource(reportId: string, source: Source, username: string): Source | undefined {
  const report = reports.get(reportId);
  if (!report) return;
  const existingIndex = report.sources.findIndex((item) => item.url === source.url);
  if (existingIndex >= 0) report.sources[existingIndex] = source;
  else report.sources.push(source);
  report.status = "In Progress";
  saveDemoReport(report, username);
  return source;
}

export function addDemoDocument(
  reportId: string,
  document: UploadedDocument,
  username: string,
): UploadedDocument | undefined {
  const report = reports.get(reportId);
  if (!report) return;
  report.documents.push(document);
  report.status = "In Progress";
  saveDemoReport(report, username);
  return document;
}

export function listDemoReportTypes(): ReportType[] {
  return [...reportTypes.values()];
}

export function getDemoReportType(id: string): ReportType | undefined {
  return reportTypes.get(id);
}

export function createDemoReportType(
  name: string,
  description: string,
  configuration: Pick<
    ReportType,
    "defaultLanguage" | "enableWebResearch" | "defaultAiPrompt" | "creativityLevel" | "requireCitations" | "reportTone" | "documentFormat"
  >,
): ReportType {
  const template: ReportType = {
    id: randomUUID(),
    name,
    description,
    defaultLanguage: configuration.defaultLanguage,
    enableWebResearch: configuration.enableWebResearch,
    defaultAiPrompt: configuration.defaultAiPrompt,
    creativityLevel: configuration.creativityLevel,
    requireCitations: configuration.requireCitations,
    reportTone: configuration.reportTone,
    documentFormat: configuration.documentFormat,
    sections: [],
    sources: [],
  };
  reportTypes.set(template.id, template);
  return template;
}

export function saveDemoReportType(template: ReportType): ReportType {
  const normalized = {
    ...template,
    sections: template.sections
      .map((section, index) => ({
        ...section,
        id: section.id || randomUUID(),
        sortOrder: index,
        aiPrompt: section.aiPrompt || "",
        requiredInputs: section.requiredInputs || [],
        sourceRequired: section.sourceRequired ?? false,
        isRequired: section.isRequired ?? true,
        isEnabled: section.isEnabled ?? true,
      })),
    defaultLanguage: template.defaultLanguage || "Turkish",
    enableWebResearch: template.enableWebResearch ?? true,
    defaultAiPrompt: template.defaultAiPrompt || "",
    creativityLevel: typeof template.creativityLevel === "number" ? template.creativityLevel : 20,
    requireCitations: template.requireCitations ?? true,
    reportTone: template.reportTone || "Technical",
    documentFormat: template.documentFormat || "DOCX",
    sources: template.sources.map((source) => ({
      ...source,
      id: source.id || randomUUID(),
    })),
  };
  reportTypes.set(template.id, normalized);
  return normalized;
}

export function deleteDemoReportType(id: string) {
  reportTypes.delete(id);
}
