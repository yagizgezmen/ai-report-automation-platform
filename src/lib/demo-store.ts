import { randomUUID } from "crypto";
import { DEFAULT_REPORT_TEMPLATES } from "@/lib/report-types";
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
  sections: template.sections.map((section, sectionIndex) => ({
    id: `demo-report-type-${templateIndex + 1}-section-${sectionIndex + 1}`,
    title: section.title,
    description: section.description,
    sortOrder: sectionIndex,
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

const globalStore = globalThis as unknown as {
  reportStore?: Map<string, Report>;
  reportTypeStore?: Map<string, ReportType>;
};
const reports = globalStore.reportStore ?? new Map([[sampleReport.id, sampleReport]]);
const reportTypes = globalStore.reportTypeStore ?? new Map(demoReportTypes.map((item) => [item.id, item]));
globalStore.reportStore = reports;
globalStore.reportTypeStore = reportTypes;

export function listDemoReports(): Report[] {
  return [...reports.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createDemoReport(input: CreateReportInput): Report {
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
  reports.set(id, report);
  return report;
}

export function getDemoReport(id: string): Report | undefined {
  return reports.get(id);
}

export function saveDemoReport(report: Report): Report {
  const saved = { ...report, updatedAt: new Date().toISOString() };
  reports.set(report.id, saved);
  return saved;
}

export function addDemoSource(reportId: string, source: Source): Source | undefined {
  const report = reports.get(reportId);
  if (!report) return;
  const existingIndex = report.sources.findIndex((item) => item.url === source.url);
  if (existingIndex >= 0) report.sources[existingIndex] = source;
  else report.sources.push(source);
  report.status = "In Progress";
  saveDemoReport(report);
  return source;
}

export function addDemoDocument(
  reportId: string,
  document: UploadedDocument,
): UploadedDocument | undefined {
  const report = reports.get(reportId);
  if (!report) return;
  report.documents.push(document);
  report.status = "In Progress";
  saveDemoReport(report);
  return document;
}

export function listDemoReportTypes(): ReportType[] {
  return [...reportTypes.values()];
}

export function getDemoReportType(id: string): ReportType | undefined {
  return reportTypes.get(id);
}

export function createDemoReportType(name: string, description: string): ReportType {
  const template: ReportType = {
    id: randomUUID(),
    name,
    description,
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
      })),
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
