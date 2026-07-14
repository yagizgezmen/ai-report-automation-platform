import OpenAI from "openai";
import { rankChunks } from "@/lib/chunking";
import { AssistantActionType, AssistantEditResponse, Report, ReportSection, Source } from "@/lib/types";
import { researchWeb } from "@/lib/services/webResearchService";

export interface GenerationResult {
  content: string;
  confidence: "High" | "Medium" | "Low";
  sourceIds: string[];
  unsupportedClaims: string[];
  missingWarnings: string[];
  discoveredSources: Source[];
}

export function reportLanguageInstruction(language: string) {
  return `Write the entire output only in the report language: ${language}. Do not switch to English unless the report language is English. Translate section names, report type names, headings, warnings, and explanatory text into the report language.`;
}

function contextFor(report: Report, section: ReportSection, researchSources = report.sources) {
  const sourceText = researchSources.map((source, index) => `[S${index + 1}] ${source.title}\n${source.content}`).join("\n\n");
  const allChunks = report.documents.flatMap((doc) => rankChunks(`${section.title} ${section.description}`, [doc.extractedText], 2).map((text) => `[D:${doc.fileName}] ${text}`));
  return `REPORT\nProject: ${report.projectName}\nType: ${report.reportType}\nLocation: ${report.location}\nParcel: ${report.parcelInfo}\nCompany notes: ${report.manualNotes}\nLanguage: ${report.outputLanguage}\nWeb research allowed: ${report.allowWebResearch ? "Yes" : "No"}\n\nSOURCES\n${sourceText || "No URL sources supplied."}\n\nDOCUMENTS\n${allChunks.join("\n\n") || "No documents supplied."}`;
}

function createOpenAIClient() {
  const config: ConstructorParameters<typeof OpenAI>[0] = {
    apiKey: process.env.OPENAI_API_KEY,
  };
  if (process.env.OPENAI_BASE_URL) {
    config.baseURL = process.env.OPENAI_BASE_URL;
  }
  return new OpenAI(config);
}

async function chatCompletion(client: OpenAI, model: string, prompt: string): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0]?.message?.content ?? "";
}

export async function generateSection(
  report: Report,
  section: ReportSection,
  instruction = "",
  sectionAiPrompt = "",
): Promise<GenerationResult> {
  if (!process.env.OPENAI_API_KEY) return demoGeneration(report, section);
  const webSources = await researchWeb({ report, section, instruction });
  const allSources = [...report.sources, ...webSources];
  const client = createOpenAIClient();
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const aiPromptInstruction = sectionAiPrompt.trim()
    ? `SECTION AI PROMPT:\n${sectionAiPrompt.trim()}\n`
    : "";
  const prompt = `You are a senior professional report writer. Draft only the requested section using exclusively the supplied context.
Never invent facts. Keep the section body free of explanations, review notes, status markers, and assistant commentary. Put support issues only in the JSON fields, not in the report text.
${reportLanguageInstruction(report.outputLanguage)}
${report.allowWebResearch
    ? "Web research is enabled, but you may use only the research results explicitly included in SOURCES. Never rely on hidden model knowledge."
    : "Web research is disabled. Use only configured sources, uploaded documents, and user notes. Never use external or background knowledge."}
Return strict JSON with keys: content, confidence (High|Medium|Low), sourceIds (array of exact source IDs), unsupportedClaims (array), missingWarnings (array).

SECTION: ${sectionName(report, section)}
PURPOSE: ${section.description}
${aiPromptInstruction}
USER INSTRUCTION: ${instruction || "Draft formal, clear business prose."}

${contextFor(report, section, allSources)}

SOURCE IDS IN ORDER: ${allSources.map((source, index) => `S${index + 1}=${source.id}`).join(", ")}`;
  const outputText = await chatCompletion(client, model, prompt);
  try {
    const parsed = JSON.parse(outputText) as Omit<GenerationResult, "discoveredSources">;
    return { ...parsed, discoveredSources: webSources };
  } catch {
    return {
      content: outputText,
      confidence: "Low",
      sourceIds: [],
      unsupportedClaims: [],
      missingWarnings: ["AI response requires manual validation."],
      discoveredSources: webSources,
    };
  }
}

export async function editSectionWithAssistant(
  report: Report,
  section: ReportSection,
  instruction: string,
  actionType: AssistantActionType = "rewrite",
  currentContent = "",
  templatePrompt = "",
  sectionPrompt = "",
): Promise<AssistantEditResponse> {
  const sourceContent = currentContent || section.content;

  if (actionType === "show_unsupported") {
    return analyzeUnsupportedClaims(report, sourceContent);
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      updatedSection: {
        ...section,
        content: rewriteDemoSection(report, section, sourceContent, instruction, templatePrompt, sectionPrompt),
      },
      assistantMessage: assistantRewriteMessage(report),
      actionType,
    };
  }

  const webSources = report.allowWebResearch
    ? await researchWeb({ report, section, instruction })
    : [];
  const client = createOpenAIClient();
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const outputText = await chatCompletion(client, model, buildAssistantEditPrompt(report, section, instruction, sourceContent, webSources, templatePrompt, sectionPrompt));
  const parsed = parseAssistantEditResponse(outputText);
  const cleanedContent = sanitizeSectionContent(parsed.updatedContent || "");
  return {
    updatedSection: {
      ...section,
      content: cleanedContent,
    },
    assistantMessage: parsed.assistantMessage || assistantRewriteMessage(report),
    actionType,
  };
}

export function demoGeneration(
  report: Report,
  section: ReportSection,
): GenerationResult {
  if (isTurkish(report)) return demoGenerationTurkish(report, section);
  const citations = report.sources.length ? " [S1]" : "";
  const evidence = report.sources.length + report.documents.length;
  const base = `${section.title} has been prepared for the ${report.projectName} project in ${report.location}. This section consolidates the available project information${report.sources.length ? ", official source material," : ""} and company-provided context into a structured professional assessment.${citations}

The subject is considered within the stated scope of the ${report.reportType}. ${report.parcelInfo ? `The supplied property reference is ${report.parcelInfo}.` : "Parcel-specific information has not yet been supplied."} Any conclusion that depends on current statutory records, plan notes, or third-party approvals should be confirmed against the latest competent-authority documentation before issue.${citations}`;
  return {
    content: base,
    confidence: evidence > 1 ? "High" : evidence === 1 ? "Medium" : "Low",
    sourceIds: report.sources.slice(0, 2).map((source) => source.id),
    unsupportedClaims: report.parcelInfo ? [] : ["Parcel-specific information has not yet been supplied."],
    missingWarnings: evidence ? ["Confirm all time-sensitive administrative records before final issue."] : ["Add an official source or source document to support factual claims."],
    discoveredSources: [],
  };
}

function isTurkish(report: Report) {
  return report.outputLanguage.toLocaleLowerCase("tr").includes("turk") ||
    report.outputLanguage.toLocaleLowerCase("tr").includes("türk");
}

function demoGenerationTurkish(
  report: Report,
  section: ReportSection,
): GenerationResult {
  const citations = report.sources.length ? " [S1]" : "";
  const evidence = report.sources.length + report.documents.length;
  const parcel = report.parcelInfo
    ? `İletilen taşınmaz bilgisi ${report.parcelInfo} olarak kaydedilmiştir.`
    : "Parsel bazlı bilgi henüz sağlanmamıştır.";
  const content = `${sectionName(report, section)}, ${report.location} konumundaki ${report.projectName} projesi için hazırlanmıştır. Bu bölüm, mevcut proje bilgilerini${report.sources.length ? ", tanımlı kaynakları" : ""} ve şirket tarafından sağlanan bağlamı resmî ve profesyonel bir değerlendirme içinde birleştirir.${citations}

Çalışma, ${reportTypeName(report)} kapsamında ele alınmıştır. ${parcel} Güncel mevzuat kayıtlarına, plan notlarına veya üçüncü taraf onaylarına bağlı tüm sonuçlar nihai rapor yayımlanmadan önce yetkili kurum belgeleriyle doğrulanmalıdır.${citations}`;

  return {
    content,
    confidence: evidence > 1 ? "High" : evidence === 1 ? "Medium" : "Low",
    sourceIds: report.sources.slice(0, 2).map((source) => source.id),
    unsupportedClaims: report.parcelInfo ? [] : ["Parsel bazlı bilgi henüz sağlanmamıştır."],
    missingWarnings: evidence
      ? ["Zamana duyarlı idari kayıtları nihai yayından önce doğrulayın."]
      : ["Olgusal iddiaları desteklemek için tanımlı bir kaynak veya belge ekleyin."],
    discoveredSources: [],
  };
}

function rewriteDemoSection(
  report: Report,
  section: ReportSection,
  currentContent: string,
  instruction: string,
  templatePrompt = "",
  sectionPrompt = "",
) {
  const base = sanitizeSectionContent(currentContent || demoGeneration(report, section).content);
  const directive = instruction.toLocaleLowerCase("tr");
  const paragraphs = base.split(/\n{2,}/).filter(Boolean);
  const promptHints = [templatePrompt, sectionPrompt].filter(Boolean).join(" ").toLocaleLowerCase("tr");

  if (directive.includes("tabl")) {
    return buildTableVersion(report, paragraphs);
  }

  let content = base;
  if (directive.includes("kısa") || directive.includes("short")) {
    content = shortenContent(paragraphs);
  } else if (directive.includes("geniş") || directive.includes("expand") || directive.includes("evidence") || directive.includes("kanıt")) {
    content = expandContent(report, section, content);
  } else if (directive.includes("resm") || directive.includes("formal") || directive.includes("official")) {
    content = makeMoreFormal(content, report);
  }

  if (directive.includes("resmî kaynak") || directive.includes("official source")) {
    content = emphasizeOfficialSources(content, report);
  }
  if (promptHints.includes("table") && !directive.includes("tabl")) {
    content = content;
  }

  return sanitizeSectionContent(content);
}

function analyzeUnsupportedClaims(report: Report, currentContent: string): AssistantEditResponse {
  const findings = findUnsupportedClaims(currentContent, report);
  return {
    updatedSection: null,
    assistantMessage: findings,
    actionType: "show_unsupported",
  };
}

function buildAssistantEditPrompt(
  report: Report,
  section: ReportSection,
  instruction: string,
  currentContent: string,
  webSources: Source[],
  templatePrompt = "",
  sectionPrompt = "",
) {
  const sourceBlock = webSources.length
    ? webSources.map((source, index) => `[WS${index + 1}] ${source.title}\n${source.content}`).join("\n\n")
    : "No web research sources.";
  return `You are editing a report section. Return only JSON with keys updatedContent and assistantMessage.
Return only the final report section content.

Do not include:
- explanations
- status messages
- editing summaries
- warnings to the user
- phrases describing what you changed
- phrases such as "the section was updated"
- manual review notes

The output will be stored directly inside the report document.

The assistantMessage must be short and belong only in the chat panel.

Report language: ${report.outputLanguage}
Section title: ${section.title}
Section description: ${section.description}
Template prompt: ${templatePrompt || "None"}
Section prompt: ${sectionPrompt || "None"}
Current content:
${currentContent}

Instruction:
${instruction}

Report context:
${contextFor(report, section, [...report.sources, ...webSources])}

Web research sources:
${sourceBlock}`;
}

function parseAssistantEditResponse(raw: string) {
  const jsonText = extractJsonBlock(raw);
  const parsed = JSON.parse(jsonText) as { updatedContent?: string | null; assistantMessage?: string };
  return {
    updatedContent: typeof parsed.updatedContent === "string" ? parsed.updatedContent : null,
    assistantMessage: typeof parsed.assistantMessage === "string" ? parsed.assistantMessage.trim() : "",
  };
}

function extractJsonBlock(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  throw new Error("Assistant response was not valid JSON.");
}

function sanitizeSectionContent(content: string) {
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => !isOperationSummary(sentence))
      .join(" ")
      .trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function isOperationSummary(text: string) {
  return /(bölüm yeniden yazıldı|içerik güncellendi|metin mevcut kaynaklara göre güncellendi|eksik bilgiler tamamlandı|bölüm daha resmî bir dille düzenlenmiştir|manuel inceleme gereklidir|manual review|required review|content updated|rewritten successfully|assistant response|başarıyla oluşturuldu)/i.test(text);
}

function shortenContent(paragraphs: string[]) {
  const selected = paragraphs.slice(0, Math.max(1, Math.min(2, paragraphs.length)));
  return selected.join("\n\n");
}

function expandContent(report: Report, section: ReportSection, content: string) {
  const extra = report.sources.length || report.documents.length
    ? (isTurkish(report)
      ? "Mevcut resmî kaynaklar ve yüklenen belgeler dikkate alınarak değerlendirme genişletildi."
      : "The assessment has been expanded using the available official sources and uploaded documents.")
    : (isTurkish(report)
      ? "İlave resmî kaynak veya belge eklendiğinde bu bölüm daha da detaylandırılabilir."
      : "This section can be expanded further when additional official sources or documents are available.");
  return `${content}\n\n${extra}`;
}

function makeMoreFormal(content: string, report: Report) {
  if (isTurkish(report)) {
    return content
      .replace(/\bbu bölüm\b/gi, "bu rapor bölümü")
      .replace(/\bşimdi\b/gi, "halen")
      .replace(/\biyi\b/gi, "uygun");
  }
  return content
    .replace(/\bthis section\b/gi, "this report section")
    .replace(/\bnow\b/gi, "currently");
}

function emphasizeOfficialSources(content: string, report: Report) {
  if (!report.sources.length && !report.documents.length) return content;
  const note = isTurkish(report)
    ? "Bu değerlendirme, tanımlı resmî kaynaklar ve yüklenen belgelerle desteklenmektedir."
    : "This assessment is supported by the configured official sources and uploaded documents.";
  return `${content}\n\n${note}`;
}

function buildTableVersion(report: Report, paragraphs: string[]) {
  const rows = paragraphs.map((paragraph, index) => {
    const title = isTurkish(report) ? `Başlık ${index + 1}` : `Item ${index + 1}`;
    return `${title} | ${paragraph.replace(/\|/g, "/")}`;
  });
  const header = isTurkish(report) ? "Başlık | İçerik" : "Title | Content";
  return [header, ...rows].join("\n");
}

function findUnsupportedClaims(currentContent: string, report: Report) {
  const lines = currentContent
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const suspicious = lines.filter((line) => isOperationSummary(line) || /\[Needs manual review\]/i.test(line));
  if (!suspicious.length) {
    return isTurkish(report)
      ? "Desteksiz iddia bulunamadı."
      : "No unsupported claims detected.";
  }
  return isTurkish(report)
    ? `Desteksiz veya açıklama amaçlı ifadeler:\n${suspicious.map((line) => `- ${line}`).join("\n")}`
    : `Unsupported or explanatory statements:\n${suspicious.map((line) => `- ${line}`).join("\n")}`;
}

function assistantRewriteMessage(report: Report) {
  return isTurkish(report)
    ? "Bölüm yeniden yazıldı."
    : "The section was rewritten.";
}

function sectionName(report: Report, section: ReportSection) {
  if (!isTurkish(report)) return section.title;
  const titles: Record<string, string> = {
    "Executive Summary": "Yönetici Özeti",
    "Project Information": "Proje Bilgileri",
    "Planning Area Location": "Planlama Alanının Konumu",
    "Regional Context": "Bölgesel Bağlam",
    "Legal / Administrative Background": "Hukuki / İdari Arka Plan",
    "Data Collected from Sources": "Kaynaklardan Toplanan Veriler",
    Analysis: "Analiz",
    "Company Assessment": "Şirket Değerlendirmesi",
    Conclusion: "Sonuç",
    References: "Kaynakça",
  };
  return titles[section.title] || section.title;
}

function reportTypeName(report: Report) {
  if (!isTurkish(report)) return report.reportType;
  const types: Record<string, string> = {
    "Planning & Development Report": "Planlama ve Geliştirme Raporu",
    "Feasibility Report": "Fizibilite Raporu",
    "Due Diligence Report": "Durum Tespit Raporu",
    "Market Assessment": "Pazar Değerlendirmesi",
  };
  return types[report.reportType] || report.reportType;
}
