export type ReportStatus = "Draft" | "In Progress" | "Needs Review" | "Completed";
export type ReviewStatus = "Not started" | "Generated" | "Needs review" | "Approved";
export type Confidence = "High" | "Medium" | "Low";

export interface Source {
  id: string;
  title: string;
  url: string;
  fetchedAt: string;
  content: string;
  isOfficial: boolean;
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
  content: string;
  reviewStatus: ReviewStatus;
  confidence: Confidence;
  unsupportedClaims: string[];
  missingWarnings: string[];
  sourceIds: string[];
}

export interface Report {
  id: string;
  reportType: string;
  projectName: string;
  location: string;
  parcelInfo: string;
  manualNotes: string;
  outputLanguage: string;
  desiredLength: number;
  status: ReportStatus;
  sections: ReportSection[];
  sources: Source[];
  documents: UploadedDocument[];
  updatedAt: string;
  createdAt: string;
}

export interface CreateReportInput {
  reportType: string;
  projectName: string;
  city: string;
  district?: string;
  neighborhood?: string;
  parcelInfo?: string;
  sourceUrls: string[];
  manualNotes?: string;
  outputLanguage: string;
  desiredLength: number;
}
