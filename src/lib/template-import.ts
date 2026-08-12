import path from "path";
import { extractDocument } from "@/lib/document-service";
import { ReportType, ReportTypeSectionConfig } from "@/lib/types";

const numberedHeadingPattern = /^((?:\d+(?:\.\d+){0,4})|(?:[IVXLCDM]+)|(?:[A-Z]))(?:[.)]|\s+-)?\s+(.{2,160})$/i;
const contentsEntryPattern = /^(.+?)(?:\s?[.·_-]{2,}\s?|\s+)(\d{1,4})$/;

function normalizeLine(value: string) {
  return value.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
}

function isContentsHeading(line: string) {
  const normalized = line
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ç/g, "c")
    .trim();
  return normalized === "icindekiler" || normalized === "contents" || normalized === "table of contents";
}

function preserveHeadingTitle(value: string) {
  return value.replace(/^[-–•]\s*/, "").trim();
}

function looksLikeUppercaseHeading(line: string) {
  return line === line.toUpperCase() && /[A-ZÇĞİÖŞÜ]/.test(line);
}

function isShortHeadingCandidate(line: string) {
  const words = line.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 12 || line.length > 120) return false;
  if (/[.!?;:]$/.test(line)) return false;
  if (line.includes("  ")) return false;
  return true;
}

function isLikelyHeading(line: string, previousLine: string, nextLine: string) {
  if (!line) return false;
  if (numberedHeadingPattern.test(line)) return true;

  const previousEmpty = !previousLine;
  const words = line.split(/\s+/).filter(Boolean);
  const uppercaseOnly = looksLikeUppercaseHeading(line);
  const titleLike = words.every((word) => /^[A-ZÇĞİÖŞÜ0-9]/.test(word));
  const nextLooksLikeBody = Boolean(nextLine) && nextLine.length > line.length;

  if (isShortHeadingCandidate(line) && previousEmpty && nextLooksLikeBody && (titleLike || uppercaseOnly)) {
    return true;
  }

  return false;
}

function buildSection(title: string, description: string, sortOrder: number): ReportTypeSectionConfig {
  return {
    id: "",
    title,
    description: description.slice(0, 5000),
    sortOrder,
    requiredInputs: [],
    sourceRequired: false,
    aiPrompt: "",
    isRequired: true,
    isEnabled: true,
  };
}

function extractSectionsFromContents(lines: string[]) {
  const contentsIndex = lines.findIndex((line) => isContentsHeading(line));
  if (contentsIndex < 0) return [];

  const sections: ReportTypeSectionConfig[] = [];
  for (let index = contentsIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      if (sections.length) break;
      continue;
    }

    if (isContentsHeading(line)) continue;

    const match = line.match(contentsEntryPattern);
    if (!match) {
      if (sections.length && (numberedHeadingPattern.test(line) || looksLikeUppercaseHeading(line))) {
        break;
      }
      continue;
    }

    const rawTitle = preserveHeadingTitle(match[1]);
    const title = rawTitle.replace(/[.·_-]{2,}\s*$/g, "").trim();
    if (!title || isContentsHeading(title)) continue;
    sections.push(buildSection(title, fallbackDescription(title), sections.length));
  }

  return sections;
}

function firstMeaningfulParagraph(lines: string[]) {
  const paragraphs = lines
    .join("\n")
    .split(/\n\s*\n/)
    .map((paragraph) => normalizeLine(paragraph))
    .filter(Boolean);

  return paragraphs[0] || "";
}

function fallbackDescription(title: string) {
  return `${title} bölümünün kapsamı ve içeriği yüklenen dokümana göre otomatik çıkarıldı.`;
}

function buildTemplateName(fileName: string, sections: ReportTypeSectionConfig[]) {
  const parsed = path.parse(fileName).name.replace(/[-_]+/g, " ").trim();
  if (parsed) return parsed;
  if (sections[0]?.title) return `${sections[0].title} Şablonu`;
  return "İçe Aktarılan Şablon";
}

export function extractTemplateSectionsFromText(text: string) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map(normalizeLine);
  const contentsSections = extractSectionsFromContents(lines);
  if (contentsSections.length) return contentsSections;
  const headingIndexes: number[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;
    if (isLikelyHeading(line, lines[index - 1] || "", lines[index + 1] || "")) {
      headingIndexes.push(index);
    }
  }

  const uniqueHeadingIndexes = headingIndexes.filter((value, index) => index === 0 || value !== headingIndexes[index - 1]);
  if (!uniqueHeadingIndexes.length) {
    const summary = firstMeaningfulParagraph(lines);
    return [buildSection("Genel Bölüm", summary || fallbackDescription("Genel Bölüm"), 0)];
  }

  return uniqueHeadingIndexes.map((headingIndex, sortOrder) => {
    const nextHeadingIndex = uniqueHeadingIndexes[sortOrder + 1] ?? lines.length;
    const title = preserveHeadingTitle(lines[headingIndex]);
    const contentLines = lines.slice(headingIndex + 1, nextHeadingIndex).filter(Boolean);
    const description = firstMeaningfulParagraph(contentLines) || fallbackDescription(title);

    return buildSection(title, description, sortOrder);
  });
}

export async function importTemplateFromDocument(file: File): Promise<Omit<ReportType, "id">> {
  const extracted = await extractDocument(file);
  const sections = extractTemplateSectionsFromText(extracted.extractedText);

  return {
    name: buildTemplateName(file.name, sections),
    description: `${file.name} dokümanından otomatik oluşturulan rapor şablonu.`,
    defaultLanguage: "Turkish",
    enableWebResearch: true,
    defaultAiPrompt: "",
    creativityLevel: 20,
    requireCitations: true,
    reportTone: "Technical",
    documentFormat: "DOCX",
    sections,
    sources: [],
  };
}