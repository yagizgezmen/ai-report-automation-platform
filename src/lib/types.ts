export type ReportStatus = "Draft" | "In Progress" | "Needs Review" | "Completed";
export type ReviewStatus = "Not started" | "Generated" | "Needs review" | "Approved";
export type Confidence = "High" | "Medium" | "Low";
export type SourceOrigin = "configured" | "manual" | "ai-discovered";
export type SourcePriority = "HIGH" | "MEDIUM" | "LOW";

export interface Source {
  id: string;
  title: string;
  url: string;
  fetchedAt: string;
  content: string;
  isOfficial: boolean;
  origin: SourceOrigin;
  searchQuery?: string;
}

export interface UploadedDocument {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  extractedText: string;
  chunks: number;
  chunkContents?: string[];
}

export interface ReportSection {
  id: string;
  title: string;
  description: string;
  requiredInputs: string[];
  sourceRequired: boolean;
  isRequired: boolean;
  content: string;
  reviewStatus: ReviewStatus;
  confidence: Confidence;
  unsupportedClaims: string[];
  missingWarnings: string[];
  sourceIds: string[];
}

export interface Report {
  id: string;
  reportTypeId?: string;
  reportType: string;
  projectName: string;
  location: string;
  parcelInfo: string;
  manualNotes: string;
  outputLanguage: string;
  allowWebResearch: boolean;
  desiredLength: number;
  status: ReportStatus;
  sections: ReportSection[];
  sources: Source[];
  documents: UploadedDocument[];
  updatedAt: string;
  createdAt: string;
}

export interface CreateReportInput {
  reportTypeId?: string;
  reportTypeName?: string;
  projectName: string;
  city: string;
  district?: string;
  neighborhood?: string;
  parcelInfo?: string;
  manualNotes?: string;
  outputLanguage: string;
  allowWebResearch: boolean;
  desiredLength: number;
}

export interface ReportTypeSectionConfig {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  requiredInputs: string[];
  sourceRequired: boolean;
  aiPrompt: string;
  isRequired: boolean;
  isEnabled: boolean;
}

export interface ReportTypeSource {
  id: string;
  name: string;
  url: string;
  description?: string;
  priority?: SourcePriority;
}

export interface ReportType {
  id: string;
  name: string;
  description: string;
  defaultLanguage: string;
  enableWebResearch: boolean;
  defaultAiPrompt: string;
  creativityLevel: number;
  requireCitations: boolean;
  reportTone: string;
  documentFormat: string;
  sections: ReportTypeSectionConfig[];
  sources: ReportTypeSource[];
}

export interface WorkspaceProfile {
  id: string;
  fullName: string;
  title: string;
  email: string;
  phone: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

export type AssistantActionType = "rewrite" | "show_unsupported";

export interface AssistantEditResponse {
  updatedSection: ReportSection | null;
  assistantMessage: string;
  actionType: AssistantActionType;
}
