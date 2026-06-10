import type { ReportSection } from "@/lib/types";

const templateSections = [
  ["Executive Summary", "A concise overview of the project, key findings, and recommendation.", ["project information", "key findings"], true],
  ["Project Information", "Core project facts, scope, ownership context, and parcel details.", ["project name", "parcel information"], false],
  ["Planning Area Location", "The site location, immediate surroundings, access, and spatial context.", ["city", "district", "neighborhood"], true],
  ["Regional Context", "Regional development patterns, infrastructure, demographics, and market context.", ["official regional data"], true],
  ["Legal / Administrative Background", "Applicable plans, decisions, permits, and administrative framework.", ["official legal sources"], true],
  ["Data Collected from Sources", "Structured synthesis of facts retrieved from official sources and documents.", ["source content"], true],
  ["Analysis", "Evidence-based interpretation of the collected planning and project information.", ["source evidence", "company methodology"], true],
  ["Company Assessment", "Professional assessment written in the company’s preferred style.", ["company notes", "analysis"], false],
  ["Conclusion", "Summary of findings, constraints, opportunities, and recommended next steps.", ["analysis", "assessment"], true],
  ["References", "Complete list of official websites and uploaded documents cited in the report.", ["sources"], true],
] as const;

export function createTemplateSections(): ReportSection[] {
  return templateSections.map(([title, description, requiredInputs, sourceRequired], index) => ({
    id: `section-${index + 1}`,
    title,
    description,
    requiredInputs: [...requiredInputs],
    sourceRequired,
    content: "",
    reviewStatus: "Not started",
    confidence: "Low",
    unsupportedClaims: [],
    missingWarnings: sourceRequired ? ["Source evidence has not been attached yet."] : [],
    sourceIds: [],
  }));
}
