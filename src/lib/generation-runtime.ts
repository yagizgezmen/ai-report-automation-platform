import { Report, ReportSection, ReportType, ReportTypeSectionConfig, Source, SourcePriority } from "@/lib/types";

export type GenerationRuntimeConfig = {
  language: string;
  globalPrompt: string;
  sectionPrompt: string;
  tone: string;
  creativityLevel: number;
  temperature: number;
  requireCitations: boolean;
  allowWebResearch: boolean;
  desiredLength: number | null;
  lengthGuidance: string;
  templateSourcePriorities: Map<string, SourcePriority>;
};

const DEFAULT_LANGUAGE = "Turkish";
const DEFAULT_TONE = "Technical";
const DEFAULT_CREATIVITY_LEVEL = 20;

export function normalizeSourcePriority(priority?: string | null): SourcePriority {
  if (priority === "HIGH" || priority === "LOW") return priority;
  return "MEDIUM";
}

function normalizedText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

export function clampCreativityLevel(value?: number | null) {
  if (!Number.isFinite(value)) return DEFAULT_CREATIVITY_LEVEL;
  return Math.min(100, Math.max(0, Math.round(value as number)));
}

export function creativityLevelToTemperature(value?: number | null) {
  return clampCreativityLevel(value) / 100;
}

export function resolveTemplateSectionConfig(
  template: ReportType | undefined,
  report: Report,
  section: ReportSection,
): ReportTypeSectionConfig | undefined {
  if (!template) return undefined;
  const sectionIndex = report.sections.findIndex((item) => item.id === section.id);
  return template.sections.find((item) => item.title === section.title)
    || template.sections.filter((item) => item.isEnabled)[sectionIndex];
}

function resolveLanguage(report: Report, template?: ReportType) {
  return normalizedText(report.outputLanguage)
    || normalizedText(template?.defaultLanguage)
    || DEFAULT_LANGUAGE;
}

function resolveTone(template?: ReportType) {
  return normalizedText(template?.reportTone) || DEFAULT_TONE;
}

function buildSourcePriorityMap(template?: ReportType) {
  const map = new Map<string, SourcePriority>();
  for (const source of template?.sources || []) {
    map.set(normalizedUrl(source.url), normalizeSourcePriority(source.priority));
  }
  return map;
}

function isCoreAnalyticalSection(sectionTitle: string) {
  return /(analysis|analiz|market|pazar|legal|hukuk|planning|planlama|financial|finans|risk|technical|teknik|data|veri|regional|bölgesel)/i.test(sectionTitle);
}

function isSummarySection(sectionTitle: string) {
  return /(executive|summary|özet|conclusion|sonuç|references|kaynakça)/i.test(sectionTitle);
}

export function buildLengthGuidance(desiredLength: number | null, sectionTitle: string) {
  if (!desiredLength || !Number.isFinite(desiredLength) || desiredLength <= 0) return "";

  const depth = desiredLength <= 20
    ? "Keep the section concise and tightly focused."
    : desiredLength <= 40
      ? "Provide moderate depth with key findings and supporting detail."
      : desiredLength <= 60
        ? "Provide detailed analysis with multiple evidence-backed findings."
        : "Provide comprehensive depth with layered evidence, nuanced findings, and clear synthesis.";

  const emphasis = isSummarySection(sectionTitle)
    ? "This is a summary-oriented section, so keep it proportionally shorter than core analysis sections."
    : isCoreAnalyticalSection(sectionTitle)
      ? "This is a core analytical section, so give it proportionally more depth than administrative or summary sections."
      : "Match the section depth to its structural role in the overall report and avoid unnecessary repetition.";

  return `Target report length: approximately ${desiredLength} pages. ${depth} ${emphasis}`;
}

export function buildToneInstruction(tone: string) {
  switch (tone) {
    case "Formal":
      return "Writing tone: Formal. Use precise, polished language appropriate for executive and institutional readers.";
    case "Legal":
      return "Writing tone: Legal. Use careful wording, regulatory precision, and legally aware phrasing suitable for formal compliance-oriented reporting.";
    case "Academic":
      return "Writing tone: Academic. Use analytical, evidence-oriented language with disciplined structure and explicit reasoning.";
    default:
      return "Writing tone: Technical. Use professional terminology appropriate for a corporate report and emphasize concrete findings over narrative filler.";
  }
}

export function buildCitationInstruction(requireCitations: boolean) {
  return requireCitations
    ? "Use citations for factual claims whenever supporting evidence is available. Use only citation identifiers provided in the evidence context. Do not invent source identifiers."
    : "Citations are optional for newly written material. Preserve existing citations when they remain accurate, and do not invent source identifiers.";
}

export function resolveGenerationRuntimeConfig(
  report: Report,
  section: ReportSection,
  template?: ReportType,
  templateSection?: ReportTypeSectionConfig,
): GenerationRuntimeConfig {
  const resolvedSection = templateSection || resolveTemplateSectionConfig(template, report, section);
  const desiredLength = Number.isFinite(report.desiredLength) && report.desiredLength > 0
    ? report.desiredLength
    : null;

  return {
    language: resolveLanguage(report, template),
    globalPrompt: normalizedText(template?.defaultAiPrompt),
    sectionPrompt: normalizedText(resolvedSection?.aiPrompt),
    tone: resolveTone(template),
    creativityLevel: clampCreativityLevel(template?.creativityLevel),
    temperature: creativityLevelToTemperature(template?.creativityLevel),
    requireCitations: template?.requireCitations ?? true,
    allowWebResearch: typeof report.allowWebResearch === "boolean"
      ? report.allowWebResearch
      : (template?.enableWebResearch ?? false),
    desiredLength,
    lengthGuidance: buildLengthGuidance(desiredLength, section.title),
    templateSourcePriorities: buildSourcePriorityMap(template),
  };
}

function sourcePriorityScore(priority: SourcePriority) {
  if (priority === "HIGH") return 3;
  if (priority === "LOW") return 1;
  return 2;
}

function relevanceScore(source: Source, query: string) {
  const haystack = `${source.title} ${source.searchQuery || ""} ${source.content.slice(0, 4000)}`.toLocaleLowerCase("tr");
  const terms = query.toLocaleLowerCase("tr").split(/\W+/).filter((term) => term.length > 3);
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

export function sortSourcesForGeneration(
  sources: Source[],
  query: string,
  runtimeConfig: GenerationRuntimeConfig,
) {
  return [...sources].sort((left, right) => {
    const leftPriority = sourcePriorityScore(runtimeConfig.templateSourcePriorities.get(normalizedUrl(left.url)) || "MEDIUM");
    const rightPriority = sourcePriorityScore(runtimeConfig.templateSourcePriorities.get(normalizedUrl(right.url)) || "MEDIUM");
    if (rightPriority !== leftPriority) return rightPriority - leftPriority;

    const leftRelevance = relevanceScore(left, query);
    const rightRelevance = relevanceScore(right, query);
    if (rightRelevance !== leftRelevance) return rightRelevance - leftRelevance;

    return Number(right.isOfficial) - Number(left.isOfficial);
  });
}

export function filterValidSourceIds(sourceIds: string[] | undefined, availableSources: Source[]) {
  const validIds = new Set(availableSources.map((source) => source.id));
  return (sourceIds || []).filter((sourceId, index, items) => validIds.has(sourceId) && items.indexOf(sourceId) === index);
}