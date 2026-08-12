import { databaseEnabled, persistenceMode } from "@/lib/prisma";
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

export async function listReports(username: string): Promise<Report[]> {
  if (databaseEnabled) return findAllReports(username);
  if (persistenceMode === "DEMO") return (await demoStore()).listDemoReports(username);
  throw new Error("Persistence is not configured. Set DATABASE_URL for PostgreSQL mode or DEMO_MODE=true for demo mode.");
}

export async function createReport(input: CreateReportInput, username: string): Promise<Report> {
  if (databaseEnabled) return createPersistedReport(input, username);
  if (persistenceMode === "DEMO") return (await demoStore()).createDemoReport(input, username);
  throw new Error("Persistence is not configured. Set DATABASE_URL for PostgreSQL mode or DEMO_MODE=true for demo mode.");
}

export async function getReport(id: string, username: string): Promise<Report | undefined> {
  return databaseEnabled
    ? findReportById(id, username)
    : persistenceMode === "DEMO"
      ? (await demoStore()).getDemoReport(id, username)
      : Promise.reject(new Error("Persistence is not configured. Set DATABASE_URL for PostgreSQL mode or DEMO_MODE=true for demo mode."));
}

export async function saveReport(report: Report, username: string): Promise<Report> {
  if (databaseEnabled) return savePersistedReport(report, username);
  if (persistenceMode === "DEMO") return (await demoStore()).saveDemoReport(report, username);
  throw new Error("Persistence is not configured. Set DATABASE_URL for PostgreSQL mode or DEMO_MODE=true for demo mode.");
}

export async function addSource(reportId: string, source: Source, username?: string): Promise<Source | undefined> {
  if (databaseEnabled) return createSource(reportId, source);
  if (persistenceMode !== "DEMO") {
    throw new Error("Persistence is not configured. Set DATABASE_URL for PostgreSQL mode or DEMO_MODE=true for demo mode.");
  }
  if (!username) throw new Error("Username is required in demo mode.");
  return (await demoStore()).addDemoSource(reportId, source, username);
}

export async function addDocument(
  reportId: string,
  document: UploadedDocument,
  username?: string,
): Promise<UploadedDocument | undefined> {
  if (databaseEnabled) return createDocument(reportId, document);
  if (persistenceMode !== "DEMO") {
    throw new Error("Persistence is not configured. Set DATABASE_URL for PostgreSQL mode or DEMO_MODE=true for demo mode.");
  }
  if (!username) throw new Error("Username is required in demo mode.");
  return (await demoStore()).addDemoDocument(reportId, document, username);
}

export async function addChatMessage(
  reportId: string,
  sectionId: string | undefined,
  role: string,
  content: string,
) {
  if (!databaseEnabled) {
    if (persistenceMode === "DEMO") return;
    throw new Error("Persistence is not configured. Set DATABASE_URL for PostgreSQL mode or DEMO_MODE=true for demo mode.");
  }
  await createChatMessage({ reportId, sectionId, role, content });
}

export async function createGenerationJob(reportId: string, sectionId: string) {
  if (!databaseEnabled) {
    if (persistenceMode === "DEMO") return `demo-${reportId}-${sectionId}-${Date.now()}`;
    throw new Error("Persistence is not configured. Set DATABASE_URL for PostgreSQL mode or DEMO_MODE=true for demo mode.");
  }
  const job = await createRunningGenerationJob(reportId, sectionId);
  return job.id;
}

export async function completeGenerationJob(jobId: string, error?: string) {
  if (!databaseEnabled) {
    if (persistenceMode === "DEMO") return;
    throw new Error("Persistence is not configured. Set DATABASE_URL for PostgreSQL mode or DEMO_MODE=true for demo mode.");
  }
  await finishGenerationJob(jobId, error);
}

export async function listReportTypes(): Promise<ReportType[]> {
  if (databaseEnabled) return findAllReportTypes();
  if (persistenceMode === "DEMO") return (await demoStore()).listDemoReportTypes();
  throw new Error("Persistence is not configured. Set DATABASE_URL for PostgreSQL mode or DEMO_MODE=true for demo mode.");
}

export async function getReportType(id: string): Promise<ReportType | undefined> {
  if (databaseEnabled) return findReportTypeById(id);
  if (persistenceMode === "DEMO") return (await demoStore()).getDemoReportType(id);
  throw new Error("Persistence is not configured. Set DATABASE_URL for PostgreSQL mode or DEMO_MODE=true for demo mode.");
}

export async function addReportType(
  name: string,
  description: string,
  configuration: Pick<
    ReportType,
    "defaultLanguage" | "enableWebResearch" | "defaultAiPrompt" | "creativityLevel" | "requireCitations" | "reportTone" | "documentFormat"
  >,
  sections: ReportType["sections"] = [],
  sources: ReportType["sources"] = [],
): Promise<ReportType> {
  if (databaseEnabled) {
    const created = await createReportType(name, description, configuration);
    if (!sections.length && !sources.length) return created;
    return saveReportType({
      ...created,
      sections,
      sources,
    });
  }
  if (persistenceMode !== "DEMO") {
    throw new Error("Persistence is not configured. Set DATABASE_URL for PostgreSQL mode or DEMO_MODE=true for demo mode.");
  }
  const created = (await demoStore()).createDemoReportType(name, description, configuration);
  if (!sections.length && !sources.length) return created;
  return (await demoStore()).saveDemoReportType({ ...created, sections, sources });
}

export async function updateReportType(template: ReportType): Promise<ReportType> {
  if (databaseEnabled) return saveReportType(template);
  if (persistenceMode === "DEMO") return (await demoStore()).saveDemoReportType(template);
  throw new Error("Persistence is not configured. Set DATABASE_URL for PostgreSQL mode or DEMO_MODE=true for demo mode.");
}

export async function removeReportType(id: string) {
  if (databaseEnabled) return deleteReportType(id);
  if (persistenceMode === "DEMO") return (await demoStore()).deleteDemoReportType(id);
  throw new Error("Persistence is not configured. Set DATABASE_URL for PostgreSQL mode or DEMO_MODE=true for demo mode.");
}

export function isDemoMode() {
  return persistenceMode === "DEMO";
}
