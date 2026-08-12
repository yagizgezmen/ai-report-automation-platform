import { Report, ReportSection, ReportStatus } from "@/lib/types";

export function deriveReportStatus(sections: ReportSection[]): ReportStatus {
  if (!sections.length) return "Draft";
  if (sections.every((section) => section.reviewStatus === "Generated" || section.reviewStatus === "Approved")) {
    return "Completed";
  }
  if (sections.some((section) => section.reviewStatus === "Needs review")) return "Needs Review";
  if (sections.some((section) => section.reviewStatus === "Generated" || section.reviewStatus === "Approved")) {
    return "In Progress";
  }
  return "Draft";
}

export function syncReportStatus(report: Report): Report {
  return {
    ...report,
    status: deriveReportStatus(report.sections),
  };
}