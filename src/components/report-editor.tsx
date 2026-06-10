"use client";

import { Report, ReportSection } from "@/lib/types";
import {
  AlertTriangle, ArrowLeft, Bot, Check, CheckCircle2, ChevronRight, Circle,
  Download, ExternalLink, File, Globe2, Loader2,
  Plus, Save, Send, ShieldCheck, Sparkles, Upload, WandSparkles,
} from "lucide-react";
import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { LanguageSelector, useLanguage } from "@/components/language-provider";
import { localizeConfidence, localizeReportStatus, localizeReportType, localizeReviewStatus, localizeSection } from "@/lib/localization";

type Tab = "assistant" | "sources" | "review";
type ChatItem = { role: "user" | "assistant"; text: string; proposedContent?: string | null };

export function ReportEditor({ reportId }: { reportId: string }) {
  const { language, t } = useLanguage();
  const [report, setReport] = useState<Report | null>(null);
  const [activeId, setActiveId] = useState("");
  const [tab, setTab] = useState<Tab>("assistant");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [chat, setChat] = useState<ChatItem[]>([{ role: "assistant", text: t("assistantReady") }]);
  const [message, setMessage] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/reports/${reportId}`).then(async (response) => {
      if (!response.ok) throw new Error("Rapor bulunamadı.");
      return response.json();
    }).then((data: Report) => {
      setReport(data);
      setActiveId(data.sections[0]?.id || "");
    }).catch((caught) => setError(caught.message));
  }, [reportId]);

  const section = useMemo(() => report?.sections.find((item) => item.id === activeId), [report, activeId]);
  const completed = report?.sections.filter((item) => item.reviewStatus !== "Not started").length || 0;
  const progress = report ? Math.round((completed / report.sections.length) * 100) : 0;

  function updateSection(changes: Partial<ReportSection>) {
    if (!report || !section) return;
    setReport({ ...report, sections: report.sections.map((item) => item.id === section.id ? { ...item, ...changes } : item) });
  }

  async function save() {
    if (!report) return;
    setBusy("save");
    const response = await fetch(`/api/reports/${report.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections: report.sections, status: report.status }),
    });
    if (response.ok) setReport(await response.json());
    else setError(language === "tr" ? "Rapor kaydedilemedi." : "Could not save the report.");
    setBusy("");
  }

  async function generate(instruction?: string) {
    if (!report || !section) return;
    setBusy("generate"); setError("");
    const response = await fetch(`/api/reports/${report.id}/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId: section.id, instruction }),
    });
    const body = await response.json();
    if (!response.ok) setError(body.error || (language === "tr" ? "İçerik oluşturulamadı." : "Generation failed."));
    else {
      setReport({
        ...report,
        status: body.reportStatus,
        sources: mergeSources(report.sources, body.discoveredSources || []),
        sections: report.sections.map((item) => item.id === section.id ? body.section : item),
      });
    }
    setBusy("");
  }

  async function askAssistant() {
    if (!report || !section || !message.trim()) return;
    const prompt = message.trim();
    setChat((items) => [...items, { role: "user", text: prompt }]); setMessage(""); setBusy("chat");
    const response = await fetch(`/api/reports/${report.id}/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId: section.id, message: prompt }),
    });
    const body = await response.json();
    setChat((items) => [...items, { role: "assistant", text: body.reply || body.error, proposedContent: body.proposedContent }]);
    if (response.ok && body.discoveredSources?.length) {
      setReport((current) => current ? { ...current, sources: mergeSources(current.sources, body.discoveredSources) } : current);
    }
    setBusy("");
  }

  async function addSource() {
    if (!report || !sourceUrl.trim()) return;
    setBusy("source"); setError("");
    const response = await fetch(`/api/reports/${report.id}/sources`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: sourceUrl.trim() }),
    });
    const body = await response.json();
    if (!response.ok) setError(body.error);
    else { setReport({ ...report, sources: [...report.sources, body] }); setSourceUrl(""); }
    setBusy("");
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    if (!report || !event.target.files?.[0]) return;
    setBusy("upload"); setError("");
    const form = new FormData(); form.append("file", event.target.files[0]);
    const response = await fetch(`/api/reports/${report.id}/documents`, { method: "POST", body: form });
    const body = await response.json();
    if (!response.ok) setError(body.error);
    else setReport({ ...report, documents: [...report.documents, body] });
    event.target.value = ""; setBusy("");
  }

  if (error && !report) return <div className="p-10 text-red-700">{error}</div>;
  if (!report || !section) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 animate-spin" size={18} /> {t("loadingWorkspace")}</div>;

  const localizedSection = localizeSection(section.title, section.description, language);
  const quickActions = [
    [t("formal"), language === "tr" ? "Bu bölümü daha resmî bir dille yeniden yaz" : "Make this section more formal"],
    [t("expandEvidence"), language === "tr" ? "Bu bölümü kanıtlarla genişlet" : "Expand this section with evidence"],
    [t("findMissing"), language === "tr" ? "Eksik bilgileri bul" : "Find missing information"],
    [t("showUnsupported"), language === "tr" ? "Desteksiz iddiaları göster" : "Show unsupported claims"],
    [t("convertTable"), language === "tr" ? "Bu bölümü tabloya dönüştür" : "Convert this section into a table"],
    [t("officialOnly"), language === "tr" ? "Yalnızca resmî kaynakları kullan" : "Use only official sources"],
  ];
  const configuredSources = report.sources.filter((source) => source.origin === "configured");
  const aiDiscoveredSources = report.sources.filter((source) => source.origin === "ai-discovered");
  const manualSources = report.sources.filter((source) => source.origin === "manual");

  return (
    <div className="h-screen overflow-hidden bg-white">
      <header className="flex h-[70px] items-center justify-between border-b border-slate-200 px-5">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft size={19} /></Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-bold">{report.projectName}</h1>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">{localizeReportStatus(report.status, language)}</span>
            </div>
            <p className="mt-1 truncate text-[11px] text-slate-500">{localizeReportType(report.reportType, language)} · {report.location}</p>
            <p className={`mt-1 text-[10px] font-semibold ${report.allowWebResearch ? "text-emerald-600" : "text-slate-400"}`}>
              {report.allowWebResearch ? t("webResearchEnabled") : t("webResearchDisabled")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelector compact />
          <span className="mr-2 text-[11px] text-slate-400">{busy === "save" ? t("saving") : t("allChangesLocal")}</span>
          <button onClick={save} className="btn-secondary flex items-center gap-2 text-xs"><Save size={15} /> {t("save")}</button>
          <a href={`/api/reports/${report.id}/export`} className="btn-primary flex items-center gap-2 text-xs"><Download size={15} /> {t("exportDocx")}</a>
        </div>
      </header>

      <div className="editor-grid grid h-[calc(100vh-70px)] grid-cols-[255px_minmax(500px,1fr)_335px]">
        <aside className="scrollbar overflow-y-auto border-r border-slate-200 bg-[#f8fafc]">
          <div className="border-b border-slate-200 p-4">
            <div className="mb-2 flex items-center justify-between text-[11px] font-bold"><span>{t("reportProgress")}</span><span className="text-blue-600">{progress}%</span></div>
            <div className="h-1.5 rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} /></div>
            <div className="mt-2 text-[10px] text-slate-500">{t("sectionsStarted", { completed, total: report.sections.length })}</div>
          </div>
          <div className="p-3">
            <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">{t("reportSections")}</div>
            {report.sections.map((item, index) => {
              const active = item.id === section.id;
              const warning = item.unsupportedClaims.length || item.missingWarnings.length;
              const localizedItem = localizeSection(item.title, item.description, language);
              return (
                <button key={item.id} onClick={() => setActiveId(item.id)} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left ${active ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-white/70"}`}>
                  {item.reviewStatus === "Approved" || item.reviewStatus === "Generated"
                    ? <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />
                    : warning ? <AlertTriangle size={15} className="shrink-0 text-amber-500" /> : <Circle size={14} className="shrink-0 text-slate-300" />}
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-[11px] font-bold ${active ? "text-blue-700" : "text-slate-700"}`}>{index + 1}. {localizedItem.title}</div>
                    <div className="mt-0.5 text-[9px] text-slate-400">{localizeReviewStatus(item.reviewStatus, language)}</div>
                  </div>
                  {active && <ChevronRight size={13} className="text-blue-500" />}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="scrollbar overflow-y-auto bg-[#f3f5f8] p-7">
          <div className="mx-auto max-w-[800px]">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[.13em] text-blue-600">{t("section")} {report.sections.findIndex((item) => item.id === section.id) + 1}</div>
                <h2 className="text-2xl font-bold tracking-tight">{localizedSection.title}</h2>
                <p className="mt-2 max-w-xl text-xs leading-5 text-slate-500">{localizedSection.description}</p>
              </div>
              <div className={`rounded-full px-3 py-1 text-[10px] font-bold ${section.confidence === "High" ? "bg-emerald-50 text-emerald-700" : section.confidence === "Medium" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                {localizeConfidence(section.confidence, language)} {t("confidence")}
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="flex h-11 items-center justify-between border-b border-slate-100 bg-slate-50 px-4">
                <div className="flex gap-4 text-[11px] text-slate-500"><b className="text-slate-700">{t("contentEditor")}</b><span>{section.content.split(/\s+/).filter(Boolean).length} {t("words")}</span></div>
                <button onClick={() => generate()} disabled={busy === "generate"} className="flex items-center gap-2 text-[11px] font-bold text-blue-600">
                  {busy === "generate" ? <Loader2 size={14} className="animate-spin" /> : <WandSparkles size={14} />} {section.content ? t("regenerateSection") : t("generateSection")}
                </button>
              </div>
              <textarea
                value={section.content}
                onChange={(event) => updateSection({ content: event.target.value, reviewStatus: "Needs review" })}
                className="min-h-[500px] w-full resize-none border-0 p-8 text-[14px] leading-7 outline-none"
                placeholder={t("editorPlaceholder")}
              />
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2 text-[10px] text-slate-500"><ShieldCheck size={14} className="text-emerald-600" /> {t("evidenceChecks")}</div>
                <button onClick={() => updateSection({ reviewStatus: "Approved" })} className="btn-secondary flex items-center gap-2 py-1.5 text-[10px]"><Check size={13} /> {t("markApproved")}</button>
              </div>
            </div>
            {error && <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}
          </div>
        </main>

        <aside className="assistant-panel flex min-h-0 flex-col border-l border-slate-200 bg-white">
          <div className="grid grid-cols-3 border-b border-slate-200">
            <TabButton active={tab === "assistant"} onClick={() => setTab("assistant")} icon={<Bot size={14} />} label={t("assistant")} />
            <TabButton active={tab === "sources"} onClick={() => setTab("sources")} icon={<Globe2 size={14} />} label={`${t("sources")} ${report.sources.length + report.documents.length}`} />
            <TabButton active={tab === "review"} onClick={() => setTab("review")} icon={<AlertTriangle size={14} />} label={t("review")} />
          </div>
          {tab === "assistant" && (
            <>
              <div className="scrollbar flex-1 space-y-3 overflow-y-auto p-4">
                <div className="mb-4 rounded-xl bg-blue-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-bold text-blue-800"><Sparkles size={14} /> {t("quickActions")}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {quickActions.map(([label, instruction]) => (
                      <button key={label} onClick={() => generate(instruction)} className="rounded-md border border-blue-100 bg-white px-2 py-1.5 text-[9px] font-bold text-blue-700">{label}</button>
                    ))}
                  </div>
                </div>
                {chat.map((item, index) => (
                  <div key={index} className={`rounded-xl p-3 text-[11px] leading-5 ${item.role === "assistant" ? "bg-slate-100 text-slate-700" : "ml-7 bg-blue-600 text-white"}`}>
                    {item.text}
                    {item.proposedContent && <button onClick={() => updateSection({ content: item.proposedContent || "", reviewStatus: "Needs review" })} className="mt-2 flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[9px] font-bold text-blue-700"><Check size={11} /> {t("applyRevision")}</button>}
                  </div>
                ))}
                {busy === "chat" && <div className="flex items-center gap-2 text-[10px] text-slate-500"><Loader2 size={13} className="animate-spin" /> {t("reviewingContext")}</div>}
              </div>
              <div className="border-t border-slate-200 p-3">
                <div className="rounded-xl border border-slate-200 p-2">
                  <textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); askAssistant(); } }} className="h-16 w-full resize-none border-0 p-1 text-[11px] outline-none" placeholder={t("askSection")} />
                  <div className="flex justify-end"><button onClick={askAssistant} className="rounded-lg bg-blue-600 p-2 text-white"><Send size={13} /></button></div>
                </div>
              </div>
            </>
          )}
          {tab === "sources" && (
            <div className="scrollbar flex-1 overflow-y-auto p-4">
              <h3 className="mb-1 text-xs font-bold">{t("evidenceLibrary")}</h3>
              <p className="mb-4 text-[10px] leading-4 text-slate-500">{t("evidenceDescription")}</p>
              <div className="mb-4 flex gap-2"><input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} className="field min-w-0 py-2 text-[10px]" placeholder="https://official-source..." /><button onClick={addSource} className="rounded-lg bg-blue-600 px-3 text-white">{busy === "source" ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />}</button></div>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" onChange={upload} hidden />
              <button onClick={() => fileRef.current?.click()} className="mb-5 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 p-3 text-[10px] font-bold text-slate-600"><Upload size={14} /> {busy === "upload" ? t("extractingText") : t("uploadFiles")}</button>
              <div className="space-y-2">
                <EvidenceGroup
                  title={t("configuredSources")}
                  sources={configuredSources}
                  reportSources={report.sources}
                  t={t}
                />
                <EvidenceGroup
                  title={t("aiDiscoveredSources")}
                  sources={aiDiscoveredSources}
                  reportSources={report.sources}
                  t={t}
                />
                <EvidenceGroup
                  title={t("manualSources")}
                  sources={manualSources}
                  reportSources={report.sources}
                  t={t}
                />
                {report.documents.map((document) => <EvidenceItem key={document.id} icon={<File size={15} />} title={document.fileName} detail={t("indexedChunks", { count: document.chunks })} />)}
                {!report.sources.length && !report.documents.length && <div className="rounded-lg bg-slate-50 p-5 text-center text-[10px] text-slate-500">{t("noEvidence")}</div>}
              </div>
            </div>
          )}
          {tab === "review" && (
            <div className="scrollbar flex-1 overflow-y-auto p-4">
              <ReviewBlock title={t("unsupportedClaims")} count={section.unsupportedClaims.length} color="red">
                {section.unsupportedClaims.map((item) => <ReviewItem key={item} text={item} />)}
              </ReviewBlock>
              <ReviewBlock title={t("missingInformation")} count={section.missingWarnings.length} color="amber">
                {section.missingWarnings.map((item) => <ReviewItem key={item} text={item} />)}
              </ReviewBlock>
              <ReviewBlock title={t("usedSources")} count={section.sourceIds.length} color="green">
                {section.sourceIds.map((id) => {
                  const source = report.sources.find((item) => item.id === id);
                  const label = source ? `${source.title} · ${sourceOriginLabel(source.origin, t)}` : id;
                  return <ReviewItem key={id} text={label} />;
                })}
              </ReviewBlock>
              {!section.unsupportedClaims.length && !section.missingWarnings.length && <div className="rounded-xl bg-emerald-50 p-4 text-[11px] leading-5 text-emerald-800"><CheckCircle2 className="mb-2" size={18} />{t("noWarnings")}</div>}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button onClick={onClick} className={`flex items-center justify-center gap-1.5 border-b-2 py-3 text-[9px] font-bold ${active ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400"}`}>{icon}{label}</button>;
}
function EvidenceGroup({
  title,
  sources,
  reportSources,
  t,
}: {
  title: string;
  sources: Report["sources"];
  reportSources: Report["sources"];
  t: ReturnType<typeof useLanguage>["t"];
}) {
  if (!sources.length) return null;
  return (
    <div className="mb-4">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">{title}</div>
      <div className="space-y-2">
        {sources.map((source) => (
          <EvidenceItem
            key={source.id}
            icon={<Globe2 size={15} />}
            title={`[S${reportSources.findIndex((item) => item.id === source.id) + 1}] ${source.title}`}
            detail={sourceDetail(source, t)}
            url={source.url}
          />
        ))}
      </div>
    </div>
  );
}
function EvidenceItem({ icon, title, detail, url }: { icon: React.ReactNode; title: string; detail: string; url?: string }) {
  return <div className="rounded-lg border border-slate-200 p-3"><div className="flex items-start gap-2"><span className="mt-0.5 text-blue-600">{icon}</span><div className="min-w-0 flex-1"><div className="truncate text-[10px] font-bold">{title}</div><div className="mt-1 text-[9px] text-slate-400">{detail}</div></div>{url && <a href={url} target="_blank" rel="noreferrer"><ExternalLink size={12} className="text-slate-400" /></a>}</div></div>;
}
function ReviewBlock({ title, count, color, children }: { title: string; count: number; color: string; children: React.ReactNode }) {
  const styles: Record<string, string> = { red: "bg-red-50 text-red-700", amber: "bg-amber-50 text-amber-700", green: "bg-emerald-50 text-emerald-700" };
  return <section className="mb-5"><div className="mb-2 flex items-center justify-between"><h3 className="text-[11px] font-bold">{title}</h3><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${styles[color]}`}>{count}</span></div><div className="space-y-2">{children}</div></section>;
}
function ReviewItem({ text }: { text: string }) {
  return <div className="rounded-lg border border-slate-200 p-3 text-[10px] leading-4 text-slate-600">{text}</div>;
}

function mergeSources(existing: Report["sources"], incoming: Report["sources"]) {
  const byUrl = new Map(existing.map((source) => [source.url, source]));
  for (const source of incoming) byUrl.set(source.url, source);
  return [...byUrl.values()];
}

function sourceOriginLabel(origin: Report["sources"][number]["origin"], t: ReturnType<typeof useLanguage>["t"]) {
  if (origin === "ai-discovered") return t("aiDiscoveredSource");
  if (origin === "manual") return t("manualSource");
  return t("configuredSource");
}

function sourceDetail(source: Report["sources"][number], t: ReturnType<typeof useLanguage>["t"]) {
  const parts = [
    source.isOfficial ? t("officialWebSource") : t("webSource"),
    sourceOriginLabel(source.origin, t),
  ];
  if (source.searchQuery) parts.push(`${t("searchQuery")}: ${source.searchQuery}`);
  return parts.join(" · ");
}
