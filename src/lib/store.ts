import { randomUUID } from "crypto";
import { createTemplateSections } from "@/lib/templates";
import { CreateReportInput, Report, Source, UploadedDocument } from "@/lib/types";

const now = new Date();
const sampleReport: Report = {
  id: "demo-report",
  reportType: "Planning & Development Report",
  projectName: "Kadıköy Coastal Planning Assessment",
  location: "Istanbul / Kadıköy / Fenerbahçe",
  parcelInfo: "Block 348, Parcels 12–15",
  manualNotes: "Focus on planning compatibility, transport access, and public realm impact.",
  outputLanguage: "English",
  desiredLength: 65,
  status: "Needs Review",
  sections: createTemplateSections().map((section, index) => ({
    ...section,
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
  }],
  documents: [],
  createdAt: new Date(now.getTime() - 86400000 * 7).toISOString(),
  updatedAt: now.toISOString(),
};

const globalStore = globalThis as unknown as { reportStore?: Map<string, Report> };
export const reportStore = globalStore.reportStore ?? new Map([[sampleReport.id, sampleReport]]);
globalStore.reportStore = reportStore;

export function listReports() {
  return [...reportStore.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createReport(input: CreateReportInput) {
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  const location = [input.city, input.district, input.neighborhood].filter(Boolean).join(" / ");
  const report: Report = {
    id,
    reportType: input.reportType,
    projectName: input.projectName,
    location,
    parcelInfo: input.parcelInfo || "",
    manualNotes: input.manualNotes || "",
    outputLanguage: input.outputLanguage,
    desiredLength: input.desiredLength,
    status: "Draft",
    sections: createTemplateSections().map((section) => ({ ...section, id: randomUUID() })),
    sources: [],
    documents: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  reportStore.set(id, report);
  return report;
}

export function getReport(id: string) {
  return reportStore.get(id);
}

export function saveReport(report: Report) {
  report.updatedAt = new Date().toISOString();
  reportStore.set(report.id, report);
  return report;
}

export function addSource(reportId: string, source: Source) {
  const report = getReport(reportId);
  if (!report) return;
  report.sources.push(source);
  report.status = "In Progress";
  saveReport(report);
  return source;
}

export function addDocument(reportId: string, document: UploadedDocument) {
  const report = getReport(reportId);
  if (!report) return;
  report.documents.push(document);
  report.status = "In Progress";
  saveReport(report);
  return document;
}
