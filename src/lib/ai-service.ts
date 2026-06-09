import OpenAI from "openai";
import { rankChunks } from "@/lib/chunking";
import { Report, ReportSection } from "@/lib/types";

interface GenerationResult {
  content: string;
  confidence: "High" | "Medium" | "Low";
  sourceIds: string[];
  unsupportedClaims: string[];
  missingWarnings: string[];
}

function contextFor(report: Report, section: ReportSection) {
  const sourceText = report.sources.map((source, index) => `[S${index + 1}] ${source.title}\n${source.content}`).join("\n\n");
  const allChunks = report.documents.flatMap((doc) => rankChunks(`${section.title} ${section.description}`, [doc.extractedText], 2).map((text) => `[D:${doc.fileName}] ${text}`));
  return `REPORT\nProject: ${report.projectName}\nType: ${report.reportType}\nLocation: ${report.location}\nParcel: ${report.parcelInfo}\nCompany notes: ${report.manualNotes}\nLanguage: ${report.outputLanguage}\n\nSOURCES\n${sourceText || "No URL sources supplied."}\n\nDOCUMENTS\n${allChunks.join("\n\n") || "No documents supplied."}`;
}

export async function generateSection(report: Report, section: ReportSection, instruction = ""): Promise<GenerationResult> {
  if (!process.env.OPENAI_API_KEY) return demoGeneration(report, section, instruction);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `You are a senior professional report writer. Draft only the requested section using exclusively the supplied context.
Never invent facts. Cite URL sources as [S1], [S2] and documents as [D:filename]. Append [Needs manual review] to any sentence that cannot be fully supported.
Return strict JSON with keys: content, confidence (High|Medium|Low), sourceIds (array of exact source IDs), unsupportedClaims (array), missingWarnings (array).

SECTION: ${section.title}
PURPOSE: ${section.description}
USER INSTRUCTION: ${instruction || "Draft formal, clear business prose."}

${contextFor(report, section)}

SOURCE IDS IN ORDER: ${report.sources.map((source, index) => `S${index + 1}=${source.id}`).join(", ")}`;
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    input: prompt,
  });
  try {
    return JSON.parse(response.output_text) as GenerationResult;
  } catch {
    return { content: response.output_text, confidence: "Low", sourceIds: [], unsupportedClaims: [], missingWarnings: ["AI response requires manual validation."] };
  }
}

export async function chatAboutSection(report: Report, section: ReportSection, message: string) {
  if (!process.env.OPENAI_API_KEY) {
    const result = await demoGeneration(report, section, message);
    return { reply: `I revised the section based on “${message}”. Unsupported facts remain visibly flagged.`, proposedContent: result.content, warnings: result.missingWarnings };
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    input: `Act as an evidence-grounded report editing assistant. Respond to the user's request using only the context. Return JSON with reply, proposedContent, warnings.\n\nCURRENT SECTION:\n${section.content}\n\nREQUEST:\n${message}\n\n${contextFor(report, section)}`,
  });
  try { return JSON.parse(response.output_text); }
  catch { return { reply: response.output_text, proposedContent: null, warnings: [] }; }
}

function demoGeneration(report: Report, section: ReportSection, instruction: string): GenerationResult {
  const citations = report.sources.length ? " [S1]" : "";
  const evidence = report.sources.length + report.documents.length;
  const base = `${section.title} has been prepared for the ${report.projectName} project in ${report.location}. This section consolidates the available project information${report.sources.length ? ", official source material," : ""} and company-provided context into a structured professional assessment.${citations}

The subject is considered within the stated scope of the ${report.reportType}. ${report.parcelInfo ? `The supplied property reference is ${report.parcelInfo}.` : "Parcel-specific information has not yet been supplied [Needs manual review]."} Any conclusion that depends on current statutory records, plan notes, or third-party approvals should be confirmed against the latest competent-authority documentation before issue.${citations}

${instruction ? `Editorial direction applied: ${instruction}. ` : ""}The available record supports a preliminary narrative, while unresolved data points are retained as explicit review items rather than presented as established facts.`;
  return {
    content: base,
    confidence: evidence > 1 ? "High" : evidence === 1 ? "Medium" : "Low",
    sourceIds: report.sources.slice(0, 2).map((source) => source.id),
    unsupportedClaims: report.parcelInfo ? [] : ["Parcel-specific information has not yet been supplied."],
    missingWarnings: evidence ? ["Confirm all time-sensitive administrative records before final issue."] : ["Add an official source or source document to support factual claims."],
  };
}
