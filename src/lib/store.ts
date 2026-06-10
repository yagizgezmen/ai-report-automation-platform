import { databaseEnabled } from "@/lib/prisma";
import {
  createPersistedReport,
  findAllReports,
  findReportById,
  savePersistedReport,
} from "@/lib/repositories/reportRepository";
import { createSource } from "@/lib/repositories/sourceRepository";
import { createDocument } from "@/lib/repositories/documentRepository";
import { createChatMessage } from "@/lib/repositories/chatRepository";
import {
  createRunningGenerationJob,
  finishGenerationJob,
} from "@/lib/repositories/generationJobRepository";
import {
  CreateReportInput,
  Report,
  ReportType,
  Source,
  UploadedDocument,
} from "@/lib/types";
import {
  createReportType,
  deleteReportType,
  findAllReportTypes,
  findReportTypeById,
  saveReportType,
} from "@/lib/repositories/reportTypeRepository";

async function demoStore() {
  return import("@/lib/demo-store");
}

export function isDemoMode() {
  return !databaseEnabled;
}

export async function listReports(): Promise<Report[]> {
  if (databaseEnabled) return findAllReports();
  return (await demoStore()).listDemoReports();
}

export async function createReport(input: CreateReportInput): Promise<Report> {
  if (databaseEnabled) return createPersistedReport(input);
  return (await demoStore()).createDemoReport(input);
}

export async function getReport(id: string): Promise<Report | undefined> {
  return databaseEnabled
    ? findReportById(id)
    : (await demoStore()).getDemoReport(id);
}

export async function saveReport(report: Report): Promise<Report> {
  if (databaseEnabled) return savePersistedReport(report);
  return (await demoStore()).saveDemoReport(report);
}

export async function addSource(reportId: string, source: Source): Promise<Source | undefined> {
  if (databaseEnabled) return createSource(reportId, source);
  return (await demoStore()).addDemoSource(reportId, source);
}

export async function addDocument(
  reportId: string,
  document: UploadedDocument,
): Promise<UploadedDocument | undefined> {
  if (databaseEnabled) return createDocument(reportId, document);
  return (await demoStore()).addDemoDocument(reportId, document);
}

export async function addChatMessage(
  reportId: string,
  sectionId: string | undefined,
  role: string,
  content: string,
) {
  if (!databaseEnabled) return;
  await createChatMessage({ reportId, sectionId, role, content });
}

export async function createGenerationJob(reportId: string, sectionId: string) {
  if (!databaseEnabled) return `demo-${reportId}-${sectionId}-${Date.now()}`;
  const job = await createRunningGenerationJob(reportId, sectionId);
  return job.id;
}

export async function completeGenerationJob(jobId: string, error?: string) {
  if (!databaseEnabled) return;
  await finishGenerationJob(jobId, error);
}

export async function listReportTypes(): Promise<ReportType[]> {
  if (databaseEnabled) return findAllReportTypes();
  return (await demoStore()).listDemoReportTypes();
}

export async function getReportType(id: string): Promise<ReportType | undefined> {
  if (databaseEnabled) return findReportTypeById(id);
  return (await demoStore()).getDemoReportType(id);
}

export async function addReportType(name: string, description: string): Promise<ReportType> {
  if (databaseEnabled) return createReportType(name, description);
  return (await demoStore()).createDemoReportType(name, description);
}

export async function updateReportType(template: ReportType): Promise<ReportType> {
  if (databaseEnabled) return saveReportType(template);
  return (await demoStore()).saveDemoReportType(template);
}

export async function removeReportType(id: string) {
  if (databaseEnabled) return deleteReportType(id);
  return (await demoStore()).deleteDemoReportType(id);
}
