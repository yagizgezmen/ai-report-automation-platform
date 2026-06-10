import { Report, ReportSection, Source } from "@/lib/types";

export interface WebResearchRequest {
  report: Report;
  section: ReportSection;
  instruction?: string;
}

export async function researchWeb(
  request: WebResearchRequest,
): Promise<Source[]> {
  if (!request.report.allowWebResearch) return [];

  // TODO: Connect an approved search provider and return normalized, fetched
  // Source records. The AI prompt may only use results returned by this service.
  return [];
}
