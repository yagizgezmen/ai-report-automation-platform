import type { ReportSection, ReportTypeSectionConfig } from "@/lib/types";

const templateSections = [
  ["Executive Summary", "A concise overview of the project, key findings, and recommendation.", ["project information", "key findings"], true, true],
  ["Project Information", "Core project facts, scope, ownership context, and parcel details.", ["project name", "parcel information"], false, true],
  ["Planning Area Location", "The site location, immediate surroundings, access, and spatial context.", ["city", "district", "neighborhood"], true, true],
  ["Regional Context", "Regional development patterns, infrastructure, demographics, and market context.", ["official regional data"], true, true],
  ["Legal / Administrative Background", "Applicable plans, decisions, permits, and administrative framework.", ["official legal sources"], true, true],
  ["Data Collected from Sources", "Structured synthesis of facts retrieved from official sources and documents.", ["source content"], true, true],
  ["Analysis", "Evidence-based interpretation of the collected planning and project information.", ["source evidence", "company methodology"], true, true],
  ["Company Assessment", "Professional assessment written in the company’s preferred style.", ["company notes", "analysis"], false, true],
  ["Conclusion", "Summary of findings, constraints, opportunities, and recommended next steps.", ["analysis", "assessment"], true, true],
  ["References", "Complete list of official websites and uploaded documents cited in the report.", ["sources"], true, true],
] as const;

export function createTemplateSections(sectionConfigs?: ReportTypeSectionConfig[]): ReportSection[] {
  const sections = sectionConfigs?.length
    ? sectionConfigs
      .filter((section) => section.isEnabled)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((section) => [section.title, section.description, section.requiredInputs, section.sourceRequired, section.isRequired] as const)
    : templateSections;
  return sections.map(([title, description, requiredInputs, sourceRequired, isRequired], index) => ({
    id: `section-${index + 1}`,
    title,
    description,
    requiredInputs: [...requiredInputs],
    sourceRequired,
    isRequired,
    content: "",
    reviewStatus: "Not started",
    confidence: "Low",
    unsupportedClaims: [],
    missingWarnings: sourceRequired ? ["Source evidence has not been attached yet."] : [],
    sourceIds: [],
  }));
}
