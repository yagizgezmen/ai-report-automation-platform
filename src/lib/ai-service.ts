import OpenAI from "openai";
import { chunkText, rankChunks } from "@/lib/chunking";
import { AssistantActionType, AssistantEditResponse, Report, ReportSection, Source } from "@/lib/types";
import { researchWeb } from "@/lib/services/webResearchService";

// ── Token budget utilities ────────────────────────────────────────────────────
// ~3.5 chars per token (mixed Turkish/English). Conservative estimate.
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

function truncateToBudget(text: string, tokenBudget: number): string {
  const charLimit = tokenBudget * 3.5;
  if (text.length <= charLimit) return text;
  return text.slice(0, Math.floor(charLimit)) + "\n[... truncated for token limit ...]";
}

// ── Context budgets (tokens) ──────────────────────────────────────────────────
const BUDGET = {
  metadata: 400,
  sectionInfo: 300,
  promptRules: 700,
  sources: 2200,
  documents: 1500,
  currentContent: 600,
  total: 5500, // safe limit under 8k request cap
};

// ── Strict prompt rules ───────────────────────────────────────────────────────
const STRICT_ANALYSIS_RULES = `
CRITICAL RULES - VIOLATIONS WILL CAUSE REJECTION:
1. Write the COMPLETED final report section — not a plan, not a template.
2. Perform the ACTUAL analysis NOW using available evidence and project context.
3. NEVER use these phrases (they will be flagged and rejected):
   - "analiz edilmelidir" / "should be analyzed"
   - "araştırılmalıdır" / "should be researched"
   - "değerlendirilebilir" / "can be evaluated"
   - "yapılabilir" / "can be done"
   - "incelenebilir" / "can be examined"
   - "daha sonra ele alınmalıdır" / "should be addressed later"
   - "ilerleyen süreçte" / "in the coming period"
   - "gerekli incelemeler yapılmalı" / "necessary examinations should be done"
4. Write SPECIFIC findings: actual numbers, actual locations, actual competitors.
5. The section must be specific to the given project, location, and report type.
6. Return ONLY the final report content. No explanations. No status messages.
`.trim();

// ── Section-specific analytical guidance ─────────────────────────────────────
function sectionAnalysisGuide(sectionTitle: string, report: Report): string {
  const title = sectionTitle.toLocaleLowerCase("tr");
  const location = report.location;

  if (title.includes("pazar") || title.includes("market")) {
    return `For this Market Analysis section, write actual findings covering:
- Geographic market definition for ${location}
- Target customer profile (demographics, income, behavior)
- Demand indicators and current market size
- Local competitors (list actual names, positioning)
- Sector trends with specific data
- Market opportunities
- Market risks and threats
- Evidence-based conclusion
Use all available source data. Do NOT describe what market analysis is.`;
  }
  if (title.includes("rekabet") || title.includes("competi")) {
    return `Write actual competitive landscape analysis for ${location}: list real competitors, their products/services, strengths/weaknesses, market shares if available, and competitive positioning.`;
  }
  if (title.includes("müşteri") || title.includes("hedef") || title.includes("customer")) {
    return `Write actual target customer profile for ${location}: demographics, income levels, buying behavior, needs, segment sizes, and evidence-based conclusions.`;
  }
  if (title.includes("talep") || title.includes("demand")) {
    return `Write actual demand analysis for ${location}: current demand level, growth trends, demand drivers, elasticity, forecasts with data, and conclusions.`;
  }
  if (title.includes("fizibilite") || title.includes("feasibilit")) {
    return `Write actual feasibility findings: financial projections, cost estimates, revenue scenarios, NPV/ROI indicators, risks, and a clear go/no-go recommendation with reasoning.`;
  }
  if (title.includes("hukuk") || title.includes("yasal") || title.includes("legal") || title.includes("idari")) {
    return `Write actual legal/administrative background: current zoning status, applicable regulations, permits required, legal constraints, and administrative history specific to ${location}.`;
  }
  if (title.includes("planlama") || title.includes("planning") || title.includes("imar")) {
    return `Write actual planning context for ${location}: current zoning designations, master plan status, development rights, infrastructure capacity, and planning authority contacts.`;
  }
  if (title.includes("finansal") || title.includes("financial") || title.includes("mali")) {
    return `Write actual financial analysis: revenue projections, cost breakdown, profitability timeline, funding requirements, sensitivity analysis, and financial risks.`;
  }
  if (title.includes("risk")) {
    return `Write an actual risk assessment: identify specific risks (market, regulatory, financial, operational), assess probability and impact for each, and propose mitigation strategies.`;
  }
  if (title.includes("sonuç") || title.includes("conclusion") || title.includes("özet") || title.includes("summary")) {
    return `Write a substantive conclusion/summary synthesizing the key findings from all report sections. Include specific recommendations and next steps.`;
  }
  return `Write substantive, evidence-based content for the "${sectionTitle}" section. Use specific data from the available sources and project context. Write actual findings, not generic descriptions.`;
}

// ── Content quality check ─────────────────────────────────────────────────────
const GENERIC_PHRASES = [
  "analiz edilmelidir", "araştırılmalıdır", "değerlendirilebilir",
  "yapılabilir", "incelenebilir", "daha sonra ele alınmalıdır",
  "ilerleyen süreçte", "gerekli incelemeler yapılmalı",
  "should be analyzed", "should be researched", "can be evaluated",
  "should be examined", "will be addressed later",
  "müşteri profilleri belirlenmelidir", "rekabet analizi yapılmalıdır",
  "pazar incelenmelidir", "bu faktörler değerlendirilmelidir",
];

export function isGenericContent(content: string): boolean {
  const lower = content.toLocaleLowerCase("tr");
  const genericCount = GENERIC_PHRASES.filter((phrase) => lower.includes(phrase)).length;
  const wordCount = content.split(/\s+/).length;
  return genericCount >= 2 || (genericCount >= 1 && wordCount < 150);
}

// ── Token-budgeted context builder ───────────────────────────────────────────
function buildSectionGenerationContext(
  report: Report,
  section: ReportSection,
  allSources: Source[],
  sourceBudget = BUDGET.sources,
  documentBudget = BUDGET.documents,
): string {
  const metadata = `PROJECT: ${report.projectName}
TYPE: ${report.reportType}
LOCATION: ${report.location}
PARCEL: ${report.parcelInfo || "Not specified"}
NOTES: ${report.manualNotes || "None"}
LANGUAGE: ${report.outputLanguage}
WEB RESEARCH: ${report.allowWebResearch ? "enabled" : "disabled"}`;

  const query = `${section.title} ${section.description}`;

  // Rank and chunk sources
  const sourceChunks: string[] = [];
  let sourceTokensUsed = 0;
  const rankedSources = [...allSources]
    .sort((a, b) => Number(b.isOfficial) - Number(a.isOfficial));

  for (const source of rankedSources) {
    const chunks = chunkText(source.content, 800, 100);
    const relevant = rankChunks(query, chunks, 2);
    for (const chunk of relevant) {
      const line = `[${source.title}] ${chunk}`;
      const cost = estimateTokens(line);
      if (sourceTokensUsed + cost > sourceBudget) break;
      sourceChunks.push(line);
      sourceTokensUsed += cost;
    }
    if (sourceTokensUsed >= sourceBudget) break;
  }

  // Rank and chunk documents
  const docChunks: string[] = [];
  let docTokensUsed = 0;
  for (const doc of report.documents) {
    const chunks = chunkText(doc.extractedText, 800, 100);
    const relevant = rankChunks(query, chunks, 2);
    for (const chunk of relevant) {
      const line = `[${doc.fileName}] ${chunk}`;
      const cost = estimateTokens(line);
      if (docTokensUsed + cost > documentBudget) break;
      docChunks.push(line);
      docTokensUsed += cost;
    }
    if (docTokensUsed >= documentBudget) break;
  }

  return `${metadata}

SOURCES (${sourceChunks.length} relevant chunks)
${sourceChunks.join("\n\n") || "No sources available. Use your knowledge of the location and project type."}

DOCUMENTS (${docChunks.length} relevant chunks)
${docChunks.join("\n\n") || "No documents uploaded."}`;
}

// ── Stricter prompt for retry ─────────────────────────────────────────────────
function buildStricterPrompt(basePrompt: string): string {
  return `${basePrompt}

IMPORTANT: Your previous response was rejected because it contained generic future-work phrases.
Write ONLY specific, concrete findings and analysis. No "should be done" statements.
Every sentence must describe an actual finding, fact, or evidence-based conclusion.`;
}

export interface GenerationResult {
  content: string;
  confidence: "High" | "Medium" | "Low";
  sourceIds: string[];
  unsupportedClaims: string[];
  missingWarnings: string[];
  discoveredSources: Source[];
}

export function reportLanguageInstruction(language: string) {
  return `Write the entire output only in the report language: ${language}. Do not switch to English unless the report language is English. Translate section names, report type names, headings, and all text into the report language.`;
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

function buildGenerationPrompt(
  report: Report,
  section: ReportSection,
  instruction: string,
  sectionAiPrompt: string,
  allSources: Source[],
  sourceBudget = BUDGET.sources,
  documentBudget = BUDGET.documents,
): string {
  const context = buildSectionGenerationContext(report, section, allSources, sourceBudget, documentBudget);
  const analysisGuide = sectionAnalysisGuide(section.title, report);
  const aiPromptPart = sectionAiPrompt.trim() ? `SECTION CUSTOM PROMPT:\n${sectionAiPrompt.trim()}\n\n` : "";
  const sourceIds = allSources.map((s, i) => `S${i + 1}=${s.id}`).join(", ");

  return `You are a senior professional report writer.

${STRICT_ANALYSIS_RULES}

${reportLanguageInstruction(report.outputLanguage)}

SECTION TO WRITE: ${sectionName(report, section)}
PURPOSE: ${section.description}
${aiPromptPart}ANALYTICAL REQUIREMENTS:
${analysisGuide}

USER INSTRUCTION: ${instruction || "Write a complete, evidence-based section with specific findings."}

Return strict JSON with these exact keys:
{
  "content": "<final report section text — no explanations, no status messages>",
  "confidence": "High|Medium|Low",
  "sourceIds": ["<array of source IDs from context>"],
  "unsupportedClaims": ["<claims without source support>"],
  "missingWarnings": ["<data gaps that affect findings>"]
}

CONTEXT:
${truncateToBudget(context, BUDGET.sources + BUDGET.documents + BUDGET.metadata)}

SOURCE IDS IN ORDER: ${sourceIds || "none"}`;
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

  const tryGenerate = async (srcBudget: number, docBudget: number, stricter = false): Promise<string> => {
    let prompt = buildGenerationPrompt(report, section, instruction, sectionAiPrompt, allSources, srcBudget, docBudget);
    if (stricter) prompt = buildStricterPrompt(prompt);
    return chatCompletion(client, model, prompt);
  };

  let outputText: string;
  try {
    outputText = await tryGenerate(BUDGET.sources, BUDGET.documents);
  } catch (err: unknown) {
    const is413 = err instanceof Error && (err.message.includes("413") || err.message.includes("too large") || err.message.includes("token"));
    if (!is413) throw err;
    // Retry with reduced budgets
    outputText = await tryGenerate(Math.floor(BUDGET.sources * 0.5), Math.floor(BUDGET.documents * 0.5));
  }

  const parseResult = (): GenerationResult => {
    try {
      const parsed = JSON.parse(outputText) as Omit<GenerationResult, "discoveredSources">;
      return { ...parsed, discoveredSources: webSources };
    } catch {
      return {
        content: sanitizeSectionContent(outputText),
        confidence: "Low",
        sourceIds: [],
        unsupportedClaims: [],
        missingWarnings: ["AI response requires manual validation."],
        discoveredSources: webSources,
      };
    }
  };

  let result = parseResult();

  // Quality check: retry once with stricter prompt if output is generic
  if (isGenericContent(result.content)) {
    try {
      const stricterOutput = await tryGenerate(BUDGET.sources, BUDGET.documents, true);
      const stricterResult = (() => {
        try {
          const parsed = JSON.parse(stricterOutput) as Omit<GenerationResult, "discoveredSources">;
          return { ...parsed, discoveredSources: webSources };
        } catch {
          return { content: sanitizeSectionContent(stricterOutput), confidence: "Low" as const, sourceIds: [], unsupportedClaims: [], missingWarnings: [], discoveredSources: webSources };
        }
      })();
      if (!isGenericContent(stricterResult.content)) {
        result = stricterResult;
      }
    } catch {
      // Keep original result if retry fails
    }
  }

  return result;
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

  const tryEdit = async (srcBudget: number, docBudget: number, stricter = false): Promise<string> => {
    let prompt = buildAssistantEditPrompt(report, section, instruction, sourceContent, [...report.sources, ...webSources], templatePrompt, sectionPrompt, srcBudget, docBudget);
    if (stricter) prompt = buildStricterPrompt(prompt);
    return chatCompletion(client, model, prompt);
  };

  let outputText: string;
  try {
    outputText = await tryEdit(BUDGET.sources, BUDGET.documents);
  } catch (err: unknown) {
    const is413 = err instanceof Error && (err.message.includes("413") || err.message.includes("too large") || err.message.includes("token"));
    if (!is413) throw err;
    outputText = await tryEdit(Math.floor(BUDGET.sources * 0.5), Math.floor(BUDGET.documents * 0.5));
  }

  let parsed = parseAssistantEditResponse(outputText);
  let cleanedContent = sanitizeSectionContent(parsed.updatedContent || "");

  // Quality check: retry once if output is generic
  if (cleanedContent && isGenericContent(cleanedContent)) {
    try {
      const stricterOutput = await tryEdit(BUDGET.sources, BUDGET.documents, true);
      const stricterParsed = parseAssistantEditResponse(stricterOutput);
      const stricterCleaned = sanitizeSectionContent(stricterParsed.updatedContent || "");
      if (stricterCleaned && !isGenericContent(stricterCleaned)) {
        parsed = stricterParsed;
        cleanedContent = stricterCleaned;
      }
    } catch {
      // Keep original result
    }
  }

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
  allSources: Source[],
  templatePrompt = "",
  sectionPrompt = "",
  sourceBudget = BUDGET.sources,
  documentBudget = BUDGET.documents,
): string {
  const analysisGuide = sectionAnalysisGuide(section.title, report);
  const context = buildSectionGenerationContext(report, section, allSources, sourceBudget, documentBudget);
  const truncatedContent = truncateToBudget(currentContent, BUDGET.currentContent);
  const customPromptPart = [templatePrompt, sectionPrompt].filter(Boolean).map((p) => `- ${p}`).join("\n");

  return `You are editing a professional report section. Return ONLY JSON with keys "updatedContent" and "assistantMessage".

${STRICT_ANALYSIS_RULES}

${reportLanguageInstruction(report.outputLanguage)}

SECTION: ${section.title}
SECTION PURPOSE: ${section.description}
${customPromptPart ? `CUSTOM PROMPTS:\n${customPromptPart}\n` : ""}
ANALYTICAL REQUIREMENTS FOR THIS SECTION:
${analysisGuide}

CURRENT CONTENT (edit this using the instruction below):
${truncatedContent}

USER INSTRUCTION: ${instruction}

AVAILABLE EVIDENCE:
${truncateToBudget(context, sourceBudget + documentBudget + BUDGET.metadata)}

Return JSON in this exact format:
{
  "updatedContent": "<rewritten final report section — specific findings, no generic phrases, no AI commentary>",
  "assistantMessage": "<short confirmation for chat panel only, e.g. 'Pazar analizi güncellendi.'>"
}`;
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
