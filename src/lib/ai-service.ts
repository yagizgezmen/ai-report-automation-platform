import OpenAI from "openai";
import { rankChunks } from "@/lib/chunking";
import { Report, ReportSection, Source } from "@/lib/types";
import { researchWeb } from "@/lib/services/webResearchService";

export interface GenerationResult {
  content: string;
  confidence: "High" | "Medium" | "Low";
  sourceIds: string[];
  unsupportedClaims: string[];
  missingWarnings: string[];
  discoveredSources: Source[];
}

export interface ChatResult {
  reply: string;
  proposedContent: string | null;
  warnings: string[];
  discoveredSources: Source[];
}

type ChatAction = "chat" | "rewrite" | "show_unsupported";

export function reportLanguageInstruction(language: string) {
  return `Write the entire output only in the report language: ${language}. Do not switch to English unless the report language is English. Translate section names, report type names, headings, warnings, and explanatory text into the report language.`;
}

function contextFor(report: Report, section: ReportSection, researchSources = report.sources) {
  const sourceText = researchSources.map((source, index) => `[S${index + 1}] ${source.title}\n${source.content}`).join("\n\n");
  const allChunks = report.documents.flatMap((doc) => rankChunks(`${section.title} ${section.description}`, [doc.extractedText], 2).map((text) => `[D:${doc.fileName}] ${text}`));
  return `REPORT\nProject: ${report.projectName}\nType: ${report.reportType}\nLocation: ${report.location}\nParcel: ${report.parcelInfo}\nCompany notes: ${report.manualNotes}\nLanguage: ${report.outputLanguage}\nWeb research allowed: ${report.allowWebResearch ? "Yes" : "No"}\n\nSOURCES\n${sourceText || "No URL sources supplied."}\n\nDOCUMENTS\n${allChunks.join("\n\n") || "No documents supplied."}`;
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
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const aiPromptInstruction = sectionAiPrompt.trim()
    ? `SECTION AI PROMPT:\n${sectionAiPrompt.trim()}\n`
    : "";
  const prompt = `You are a senior professional report writer. Draft only the requested section using exclusively the supplied context.
Never invent facts. Cite URL sources as [S1], [S2] and documents as [D:filename]. Append [Needs manual review] to any sentence that cannot be fully supported.
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
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    input: prompt,
  });
  try {
    const parsed = JSON.parse(response.output_text) as Omit<GenerationResult, "discoveredSources">;
    return { ...parsed, discoveredSources: webSources };
  } catch {
    return {
      content: response.output_text,
      confidence: "Low",
      sourceIds: [],
      unsupportedClaims: [],
      missingWarnings: ["AI response requires manual validation."],
      discoveredSources: webSources,
    };
  }
}

export async function chatAboutSection(
  report: Report,
  section: ReportSection,
  message: string,
  action: ChatAction = "chat",
): Promise<ChatResult> {
  if (action === "show_unsupported") {
    const unsupported = section.unsupportedClaims.length
      ? section.unsupportedClaims.map((item) => `- ${item}`).join("\n")
      : (isTurkish(report) ? "Desteksiz iddia bulunmadı." : "No unsupported claims detected.");
    const missing = section.missingWarnings.length
      ? section.missingWarnings.map((item) => `- ${item}`).join("\n")
      : (isTurkish(report) ? "Eksik bilgi uyarısı bulunmadı." : "No missing information warnings detected.");
    const reply = isTurkish(report)
      ? `Desteksiz iddia analizi tamamlandı.\n\nDesteksiz iddialar:\n${unsupported}\n\nEksik bilgi uyarıları:\n${missing}`
      : `Unsupported-claim analysis completed.\n\nUnsupported claims:\n${unsupported}\n\nMissing-information warnings:\n${missing}`;
    return { reply, proposedContent: null, warnings: [], discoveredSources: [] };
  }

  if (!process.env.OPENAI_API_KEY) {
    if (action === "rewrite") {
      const result = await demoGeneration(report, section);
      const reply = isTurkish(report)
        ? "Bölüm yeniden yazıldı ve içerik güncellendi."
        : "The section was rewritten and content was updated.";
      return { reply, proposedContent: result.content, warnings: result.missingWarnings, discoveredSources: [] };
    }
    const reply = isTurkish(report)
      ? "Yardımcı asistan yanıtı oluşturuldu. İçeriği değiştirmek için bir düzenleme isteği verin."
      : "Assistant response generated. Ask for an editing action to change section content.";
    return { reply, proposedContent: null, warnings: [], discoveredSources: [] };
  }
  const webSources = await researchWeb({ report, section, instruction: message });
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const modeInstruction = action === "rewrite"
    ? `Return JSON with keys: reply, proposedContent, warnings.
proposedContent must contain only the final rewritten section body.
Do not include explanations, meta-notes, assistant commentary, or prefixes like "Based on your request".
Preserve paragraph structure and keep existing citations when still valid.`
    : `Return JSON with keys: reply, proposedContent, warnings.
If no rewrite is explicitly requested, set proposedContent to null and keep explanations in reply only.`;
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    input: `Act as an evidence-grounded report editing assistant. Respond to the user's request using only the supplied context.
${reportLanguageInstruction(report.outputLanguage)}
${report.allowWebResearch
    ? "Use only the explicit web research results included in SOURCES."
    : "Web research is disabled. Do not use external or background knowledge."}
${modeInstruction}

CURRENT SECTION:
${section.content}

REQUEST:
${message}

${contextFor(report, section, [...report.sources, ...webSources])}`,
  });
  try {
    return { ...JSON.parse(response.output_text), discoveredSources: webSources } as ChatResult;
  } catch {
    return { reply: response.output_text, proposedContent: null, warnings: [], discoveredSources: webSources };
  }
}

export function demoGeneration(
  report: Report,
  section: ReportSection,
): GenerationResult {
  if (isTurkish(report)) return demoGenerationTurkish(report, section);
  const citations = report.sources.length ? " [S1]" : "";
  const evidence = report.sources.length + report.documents.length;
  const base = `${section.title} has been prepared for the ${report.projectName} project in ${report.location}. This section consolidates the available project information${report.sources.length ? ", official source material," : ""} and company-provided context into a structured professional assessment.${citations}

The subject is considered within the stated scope of the ${report.reportType}. ${report.parcelInfo ? `The supplied property reference is ${report.parcelInfo}.` : "Parcel-specific information has not yet been supplied [Needs manual review]."} Any conclusion that depends on current statutory records, plan notes, or third-party approvals should be confirmed against the latest competent-authority documentation before issue.${citations}

The available record supports a preliminary narrative, while unresolved data points are retained as explicit review items rather than presented as established facts.`;
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
    : "Parsel bazlı bilgi henüz sağlanmamıştır [Manuel inceleme gerekli].";
  const content = `${sectionName(report, section)}, ${report.location} konumundaki ${report.projectName} projesi için hazırlanmıştır. Bu bölüm, mevcut proje bilgilerini${report.sources.length ? ", tanımlı kaynakları" : ""} ve şirket tarafından sağlanan bağlamı resmî ve profesyonel bir değerlendirme içinde birleştirir.${citations}

Çalışma, ${reportTypeName(report)} kapsamında ele alınmıştır. ${parcel} Güncel mevzuat kayıtlarına, plan notlarına veya üçüncü taraf onaylarına bağlı tüm sonuçlar nihai rapor yayımlanmadan önce yetkili kurum belgeleriyle doğrulanmalıdır.${citations}

Mevcut kayıtlar ön değerlendirme yapılmasına olanak tanımakta; çözümlenmemiş veri noktaları kesin bilgi gibi sunulmak yerine açık inceleme maddeleri olarak korunmaktadır.`;

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
