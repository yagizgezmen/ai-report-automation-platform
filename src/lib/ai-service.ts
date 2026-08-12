import { chunkText, rankChunks } from "@/lib/chunking";
import { toUserFacingAIError } from "@/lib/ai/errors";
import { extractStructuredStringField, parseJsonText } from "@/lib/ai/json";
import { getAIProvider } from "@/lib/ai/provider-factory";
import { AIProviderError } from "@/lib/ai/types";
import { filterValidSourceIds, GenerationRuntimeConfig, resolveGenerationRuntimeConfig, resolveTemplateSectionConfig, sortSourcesForGeneration, buildCitationInstruction, buildToneInstruction } from "@/lib/generation-runtime";
import { AssistantActionType, AssistantEditResponse, Report, ReportSection, ReportType, Source } from "@/lib/types";
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
  runtimeConfig: GenerationRuntimeConfig,
  instruction = "",
  sourceBudget = BUDGET.sources,
  documentBudget = BUDGET.documents,
): string {
  const language = runtimeConfig.language;
  const metadata = `PROJECT: ${report.projectName}
TYPE: ${report.reportType}
LOCATION: ${report.location}
PARCEL: ${report.parcelInfo || "Not specified"}
NOTES: ${report.manualNotes || "None"}
LANGUAGE: ${language}
WEB RESEARCH: ${runtimeConfig.allowWebResearch ? "enabled" : "disabled"}`;

  const query = `${section.title} ${section.description} ${instruction}`.trim();

  // Rank and chunk sources
  const sourceChunks: string[] = [];
  let sourceTokensUsed = 0;
  const rankedSources = sortSourcesForGeneration(allSources, query, runtimeConfig);

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

const GENERATION_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    content: { type: "string" },
    confidence: { type: "string", enum: ["High", "Medium", "Low"] },
    sourceIds: { type: "array", items: { type: "string" } },
    unsupportedClaims: { type: "array", items: { type: "string" } },
    missingWarnings: { type: "array", items: { type: "string" } },
  },
  required: ["content", "confidence", "sourceIds", "unsupportedClaims", "missingWarnings"],
} satisfies Record<string, unknown>;

const ASSISTANT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    updatedContent: { type: "string" },
    assistantMessage: { type: "string" },
  },
  required: ["updatedContent", "assistantMessage"],
} satisfies Record<string, unknown>;

async function runtimeChatCompletion(
  model: string,
  systemInstruction: string,
  prompt: string,
  runtimeConfig: GenerationRuntimeConfig,
  responseSchema?: Record<string, unknown>,
) {
  const provider = getAIProvider();

  try {
    const response = await provider.generate({
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt },
      ],
      temperature: runtimeConfig.temperature,
      maxOutputTokens: 1600,
      responseMimeType: responseSchema ? "application/json" : undefined,
      responseSchema,
    });
    return response.content;
  } catch (error) {
    if (error instanceof AIProviderError && error.kind === "configuration") {
      throw toUserFacingAIError();
    }
    const message = error instanceof Error ? error.message : String(error);
    if (/(temperature|unsupported|not supported|invalid.+temperature)/i.test(message)) {
      console.info(`[GENERATION] creativityUnsupported=true provider=${provider.name} model=${model}`);
      const response = await provider.generate({
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt },
        ],
        maxOutputTokens: 1600,
        responseMimeType: responseSchema ? "application/json" : undefined,
        responseSchema,
      });
      return response.content;
    }
    throw toUserFacingAIError();
  }
}

function buildSystemInstruction(runtimeConfig: GenerationRuntimeConfig) {
  return `You are a senior professional report writer.

${STRICT_ANALYSIS_RULES}

Write the entire final report section only in: ${runtimeConfig.language}.
Do not switch languages unless explicitly required by the source material.`;
}

function logGenerationRuntime(mode: "generate" | "assistant", runtimeConfig: GenerationRuntimeConfig, sourceCount: number) {
  console.info(`[GENERATION] mode=${mode} language=${runtimeConfig.language} tone=${runtimeConfig.tone.toLowerCase()} creativity=${runtimeConfig.creativityLevel} citations=${runtimeConfig.requireCitations} webResearch=${runtimeConfig.allowWebResearch} sourceCount=${sourceCount}`);
}

function buildGenerationPrompt(
  report: Report,
  section: ReportSection,
  instruction: string,
  runtimeConfig: GenerationRuntimeConfig,
  allSources: Source[],
  sourceBudget = BUDGET.sources,
  documentBudget = BUDGET.documents,
): string {
  const context = buildSectionGenerationContext(report, section, allSources, runtimeConfig, instruction, sourceBudget, documentBudget);
  const analysisGuide = sectionAnalysisGuide(section.title, report);
  const globalPromptPart = runtimeConfig.globalPrompt ? `TEMPLATE-WIDE INSTRUCTION:\n${runtimeConfig.globalPrompt}\n\n` : "";
  const aiPromptPart = runtimeConfig.sectionPrompt ? `SECTION CUSTOM PROMPT:\n${runtimeConfig.sectionPrompt}\n\n` : "";
  const lengthPart = runtimeConfig.lengthGuidance ? `LENGTH GUIDANCE:\n${runtimeConfig.lengthGuidance}\n\n` : "";
  const sourceIds = allSources.map((s, i) => `S${i + 1}=${s.id}`).join(", ");

  return `${globalPromptPart}TONE:
${buildToneInstruction(runtimeConfig.tone)}

CITATION REQUIREMENT:
${buildCitationInstruction(runtimeConfig.requireCitations)}

${lengthPart}SECTION TO WRITE: ${sectionName(report, section)}
PURPOSE: ${section.description}
${aiPromptPart}ANALYTICAL REQUIREMENTS:
${analysisGuide}

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

SOURCE IDS IN ORDER: ${sourceIds || "none"}

USER INSTRUCTION: ${instruction || "Write a complete, evidence-based section with specific findings."}`;
}

export async function generateSection(
  report: Report,
  section: ReportSection,
  options: { instruction?: string; template?: ReportType } = {},
): Promise<GenerationResult> {
  const instruction = options.instruction || "";
  const provider = getAIProvider();
  if (!provider.configured) return demoGeneration(report, section);

  const templateSection = resolveTemplateSectionConfig(options.template, report, section);
  const runtimeConfig = resolveGenerationRuntimeConfig(report, section, options.template, templateSection);
  const webSources = runtimeConfig.allowWebResearch ? await researchWeb({ report, section, instruction }) : [];
  const allSources = [...report.sources, ...webSources];
  const model = provider.model;
  const systemInstruction = buildSystemInstruction(runtimeConfig);

  logGenerationRuntime("generate", runtimeConfig, allSources.length);

  const tryGenerate = async (srcBudget: number, docBudget: number, stricter = false): Promise<string> => {
    let prompt = buildGenerationPrompt(report, section, instruction, runtimeConfig, allSources, srcBudget, docBudget);
    if (stricter) prompt = buildStricterPrompt(prompt);
    return runtimeChatCompletion(model, systemInstruction, prompt, runtimeConfig, GENERATION_RESPONSE_SCHEMA);
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
      const parsed = parseJsonText<Omit<GenerationResult, "discoveredSources">>(outputText);
      return {
        ...parsed,
        sourceIds: filterValidSourceIds(Array.isArray(parsed.sourceIds) ? parsed.sourceIds : [], allSources),
        discoveredSources: webSources,
      };
    } catch {
      const recoveredContent = extractStructuredStringField(outputText, "content");
      return {
        content: sanitizeSectionContent(recoveredContent || outputText),
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
          const parsed = parseJsonText<Omit<GenerationResult, "discoveredSources">>(stricterOutput);
          return { ...parsed, sourceIds: filterValidSourceIds(Array.isArray(parsed.sourceIds) ? parsed.sourceIds : [], allSources), discoveredSources: webSources };
        } catch {
          const recoveredContent = extractStructuredStringField(stricterOutput, "content");
          return { content: sanitizeSectionContent(recoveredContent || stricterOutput), confidence: "Low" as const, sourceIds: [], unsupportedClaims: [], missingWarnings: [], discoveredSources: webSources };
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
  template?: ReportType,
): Promise<AssistantEditResponse> {
  const sourceContent = currentContent || section.content;
  const provider = getAIProvider();

  if (actionType === "show_unsupported") {
    return analyzeUnsupportedClaims(report, sourceContent);
  }

  if (!provider.configured) {
    return {
      updatedSection: {
        ...section,
        content: rewriteDemoSection(report, section, sourceContent, instruction),
      },
      assistantMessage: assistantRewriteMessage(report),
      actionType,
    };
  }

  const templateSection = resolveTemplateSectionConfig(template, report, section);
  const runtimeConfig = resolveGenerationRuntimeConfig(report, section, template, templateSection);
  const webSources = runtimeConfig.allowWebResearch ? await researchWeb({ report, section, instruction }) : [];

  const model = provider.model;
  const systemInstruction = buildSystemInstruction(runtimeConfig);

  logGenerationRuntime("assistant", runtimeConfig, report.sources.length + webSources.length);

  const tryEdit = async (srcBudget: number, docBudget: number, stricter = false): Promise<string> => {
    let prompt = buildAssistantEditPrompt(report, section, instruction, sourceContent, [...report.sources, ...webSources], runtimeConfig, srcBudget, docBudget);
    if (stricter) prompt = buildStricterPrompt(prompt);
    return runtimeChatCompletion(model, systemInstruction, prompt, runtimeConfig, ASSISTANT_RESPONSE_SCHEMA);
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
) {
  const base = sanitizeSectionContent(currentContent || demoGeneration(report, section).content);
  const directive = instruction.toLocaleLowerCase("tr");
  const paragraphs = base.split(/\n{2,}/).filter(Boolean);

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
  runtimeConfig: GenerationRuntimeConfig,
  sourceBudget = BUDGET.sources,
  documentBudget = BUDGET.documents,
): string {
  const analysisGuide = sectionAnalysisGuide(section.title, report);
  const context = buildSectionGenerationContext(report, section, allSources, runtimeConfig, instruction, sourceBudget, documentBudget);
  const truncatedContent = truncateToBudget(currentContent, BUDGET.currentContent);
  const customPromptPart = [runtimeConfig.globalPrompt, runtimeConfig.sectionPrompt].filter(Boolean).map((p) => `- ${p}`).join("\n");
  const lengthPart = runtimeConfig.lengthGuidance ? `${runtimeConfig.lengthGuidance}\n` : "";

  return `You are editing a professional report section. Return ONLY JSON with keys "updatedContent" and "assistantMessage".

TONE:
${buildToneInstruction(runtimeConfig.tone)}

CITATION REQUIREMENT:
${buildCitationInstruction(runtimeConfig.requireCitations)}

${lengthPart}SECTION: ${section.title}
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
  let parsed: { updatedContent?: string | null; assistantMessage?: string };
  try {
    parsed = parseJsonText<{ updatedContent?: string | null; assistantMessage?: string }>(raw);
  } catch {
    parsed = {
      updatedContent: extractStructuredStringField(raw, "updatedContent"),
      assistantMessage: extractStructuredStringField(raw, "assistantMessage") || "",
    };
  }
  return {
    updatedContent: typeof parsed.updatedContent === "string" ? parsed.updatedContent : null,
    assistantMessage: typeof parsed.assistantMessage === "string" ? parsed.assistantMessage.trim() : "",
  };
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
