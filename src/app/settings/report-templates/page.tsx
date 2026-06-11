"use client";

import { AppShell } from "@/components/app-shell";
import { useLanguage } from "@/components/language-provider";
import { ReportType } from "@/lib/types";
import { FileText, Globe2, GripVertical, Loader2, Plus, Save, Settings2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type TemplateTab = "sections" | "sources" | "general";

export default function ReportTemplatesPage() {
  const { t } = useLanguage();
  const [templates, setTemplates] = useState<ReportType[]>([]);
  const [activeId, setActiveId] = useState("");
  const [tab, setTab] = useState<TemplateTab>("sections");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");

  const loadTemplates = useCallback(async (preferredId?: string) => {
    setBusy("load");
    const response = await fetch("/api/report-types");
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || t("templateSaveError"));
    setTemplates(body);
    setActiveId((current) => preferredId || current || body[0]?.id || "");
    return body as ReportType[];
  }, [t]);

  useEffect(() => {
    loadTemplates()
      .catch((caught) => setMessage(caught.message))
      .finally(() => setBusy(""));
  }, [loadTemplates]);

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === activeId),
    [templates, activeId],
  );

  function buildTemplateName() {
    const candidate = newTemplateName.trim();
    if (candidate) return candidate;
    return `${t("untitledTemplate")} ${templates.length + 1}`;
  }

  function buildStarterTemplatePayload() {
    const templateName = buildTemplateName();
    return {
      name: templateName,
      description: t("untitledTemplateDescription"),
      sections: [
        { title: t("starterSectionIntro"), description: t("starterSectionIntroDescription"), sortOrder: 0 },
        { title: t("starterSectionAnalysis"), description: t("starterSectionAnalysisDescription"), sortOrder: 1 },
        { title: t("starterSectionConclusion"), description: t("starterSectionConclusionDescription"), sortOrder: 2 },
      ],
      sources: [],
    };
  }

  function updateActiveTemplate(mutator: (template: ReportType) => ReportType) {
    setTemplates((items) => items.map((item) => item.id === activeId ? mutator(item) : item));
  }

  function normalizeTemplate(template: ReportType): ReportType {
    return {
      ...template,
      name: template.name.trim(),
      description: template.description.trim(),
      sections: template.sections
        .map((section, index) => ({
          ...section,
          title: section.title.trim(),
          description: section.description.trim(),
          sortOrder: index,
        }))
        .filter((section) => section.title || section.description),
      sources: template.sources
        .map((source) => ({
          ...source,
          name: source.name.trim(),
          url: source.url.trim(),
          description: (source.description || "").trim(),
        }))
        .filter((source) => source.name || source.url || source.description),
    };
  }

  function templateValidationError(template: ReportType) {
    if (!template.name.trim()) return t("templateNameRequired");
    const invalidSection = template.sections.find((section) => (section.title.trim() || section.description.trim()) && !section.title.trim());
    if (invalidSection) return t("templateSectionTitleRequired");
    const invalidSourceName = template.sources.find((source) => (source.name.trim() || source.url.trim() || (source.description || "").trim()) && !source.name.trim());
    if (invalidSourceName) return t("templateSourceNameRequired");
    const invalidSourceUrl = template.sources.find((source) => (source.name.trim() || source.url.trim() || (source.description || "").trim()) && !source.url.trim());
    if (invalidSourceUrl) return t("templateSourceUrlRequired");
    const malformedUrl = template.sources.find((source) => {
      if (!source.url.trim()) return false;
      try {
        new URL(source.url.trim());
        return false;
      } catch {
        return true;
      }
    });
    if (malformedUrl) return t("templateSourceUrlInvalid");
    return "";
  }

  function formatError(body: { error?: string; details?: Record<string, string[] | undefined> }) {
    const detailMessages = Object.values(body.details || {}).flat().filter(Boolean) as string[];
    return detailMessages[0] || body.error || t("templateSaveError");
  }

  async function createTemplate(options?: { useStarterTemplate?: boolean }) {
    setBusy("create");
    setMessage("");
    const payload = options?.useStarterTemplate
      ? buildStarterTemplatePayload()
      : { name: buildTemplateName(), description: "" };
    const response = await fetch("/api/report-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(formatError(body));
    } else {
      await loadTemplates(body.id);
      setNewTemplateName("");
      setMessage(t("templateCreated"));
    }
    setBusy("");
  }

  async function saveTemplate() {
    if (!activeTemplate) return;
    const validationMessage = templateValidationError(activeTemplate);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    setBusy("save");
    setMessage("");
    const normalized = normalizeTemplate(activeTemplate);
    const response = await fetch(`/api/report-types/${activeTemplate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalized),
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(formatError(body));
    } else {
      await loadTemplates(body.id);
      setMessage(t("templateSaved"));
    }
    setBusy("");
  }

  async function deleteTemplate() {
    if (!activeTemplate) return;
    setBusy("delete");
    setMessage("");
    const response = await fetch(`/api/report-types/${activeTemplate.id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error || t("templateSaveError"));
    } else {
      const nextTemplates = templates.filter((item) => item.id !== activeTemplate.id);
      setTemplates(nextTemplates);
      setActiveId(nextTemplates[0]?.id || "");
      setMessage(t("templateDeleted"));
    }
    setBusy("");
  }

  function reorderSections(draggedIndex: number, targetIndex: number) {
    if (!activeTemplate || draggedIndex === targetIndex) return;
    const sections = [...activeTemplate.sections];
    const [moved] = sections.splice(draggedIndex, 1);
    sections.splice(targetIndex, 0, moved);
    updateActiveTemplate((template) => ({
      ...template,
      sections: sections.map((section, index) => ({ ...section, sortOrder: index })),
    }));
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-[1180px] p-8">
        <div className="mb-7">
          <p className="mb-1 text-xs font-bold uppercase tracking-[.14em] text-blue-600">{t("settings")}</p>
          <h1 className="text-3xl font-bold tracking-tight">{t("reportTemplatesTitle")}</h1>
          <p className="mt-2 text-sm text-slate-500">{t("reportTemplatesDescription")}</p>
        </div>

        <div className="grid grid-cols-[300px_1fr] gap-6">
          <aside className="card p-5">
            <h2 className="text-sm font-bold">{t("reportTemplates")}</h2>
            <div className="mt-4 flex gap-2">
              <input
                value={newTemplateName}
                onChange={(event) => setNewTemplateName(event.target.value)}
                placeholder={t("createTemplatePlaceholder")}
                className="field"
              />
              <button onClick={() => createTemplate()} disabled={busy === "create"} className="btn-primary shrink-0 px-3" aria-label={t("createReportType")}>
                {busy === "create" ? <Loader2 size={15} className="animate-spin" /> : <Plus size={16} />}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">{t("templateCreateHint")}</p>
            <div className="mt-5 space-y-2">
              {busy === "load" && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> {t("loadingTemplates")}</div>}
              {!busy && !templates.length && <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">{t("noReportTypes")}</div>}
              {!busy && !templates.length && (
                <button onClick={() => createTemplate({ useStarterTemplate: true })} disabled={busy === "create"} className="mt-3 btn-primary w-full">
                  {t("createFirstTemplate")}
                </button>
              )}
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setActiveId(template.id)}
                  className={`w-full rounded-xl border p-4 text-left ${template.id === activeId ? "border-blue-200 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <div className="font-bold text-slate-800">{template.name}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">{template.description || t("generalSettings")}</div>
                </button>
              ))}
            </div>
          </aside>

          <section className="card p-6">
            {!activeTemplate ? (
              <div className="rounded-xl bg-slate-50 p-10 text-center text-sm text-slate-500">{t("emptyTemplateState")}</div>
            ) : (
              <>
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">{activeTemplate.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">{activeTemplate.description || t("templateDescriptionPlaceholder")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={deleteTemplate} disabled={busy === "delete"} className="btn-secondary flex items-center gap-2 text-xs text-red-600">
                      <Trash2 size={14} /> {t("deleteReportType")}
                    </button>
                    <button onClick={saveTemplate} disabled={busy === "save"} className="btn-primary flex items-center gap-2 text-xs">
                      {busy === "save" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      {t("saveTemplate")}
                    </button>
                  </div>
                </div>

                <div className="mb-6 grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1">
                  <TabButton active={tab === "sections"} onClick={() => setTab("sections")} icon={<FileText size={14} />} label={t("sectionsTab")} />
                  <TabButton active={tab === "sources"} onClick={() => setTab("sources")} icon={<Globe2 size={14} />} label={t("sourcesTab")} />
                  <TabButton active={tab === "general"} onClick={() => setTab("general")} icon={<Settings2 size={14} />} label={t("generalTab")} />
                </div>

                {tab === "general" && (
                  <div className="space-y-4">
                    <Field label={t("reportType")}>
                      <input
                        value={activeTemplate.name}
                        onChange={(event) => updateActiveTemplate((template) => ({ ...template, name: event.target.value }))}
                        className="field"
                      />
                    </Field>
                    <Field label={t("generalSettings")}>
                      <textarea
                        value={activeTemplate.description}
                        onChange={(event) => updateActiveTemplate((template) => ({ ...template, description: event.target.value }))}
                        className="field min-h-32 resize-y"
                        placeholder={t("templateDescriptionPlaceholder")}
                      />
                    </Field>
                  </div>
                )}

                {tab === "sections" && (
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <div className="text-sm text-slate-500">{t("dragToReorder")}</div>
                      <button
                        onClick={() => updateActiveTemplate((template) => ({
                          ...template,
                          sections: [...template.sections, { id: "", title: "", description: "", sortOrder: template.sections.length }],
                        }))}
                        className="btn-secondary flex items-center gap-2 text-xs"
                      >
                        <Plus size={14} /> {t("addSection")}
                      </button>
                    </div>
                    <div className="space-y-3">
                      {!activeTemplate.sections.length && <div className="rounded-xl bg-slate-50 p-8 text-sm text-slate-500">{t("noSections")}</div>}
                      {activeTemplate.sections.map((section, index) => (
                        <div
                          key={section.id || `new-${index}`}
                          draggable
                          onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            const draggedIndex = Number(event.dataTransfer.getData("text/plain"));
                            reorderSections(draggedIndex, index);
                          }}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                              <GripVertical size={16} className="text-slate-400" />
                              {t("section")} {section.sortOrder + 1}
                            </div>
                            <button
                              onClick={() => updateActiveTemplate((template) => ({
                                ...template,
                                sections: template.sections.filter((item) => item !== section).map((item, index) => ({ ...item, sortOrder: index })),
                              }))}
                              className="rounded-lg border border-red-100 px-3 py-2 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <Field label={t("sectionTitle")}>
                              <input
                                value={section.title}
                                onChange={(event) => updateActiveTemplate((template) => ({
                                  ...template,
                                  sections: template.sections.map((item) => item === section ? { ...item, title: event.target.value } : item),
                                }))}
                                className="field"
                              />
                            </Field>
                            <Field label={t("sectionDescription")}>
                              <textarea
                                value={section.description}
                                onChange={(event) => updateActiveTemplate((template) => ({
                                  ...template,
                                  sections: template.sections.map((item) => item === section ? { ...item, description: event.target.value } : item),
                                }))}
                                className="field min-h-24 resize-y"
                              />
                            </Field>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tab === "sources" && (
                  <div>
                    <div className="mb-4 flex justify-end">
                      <button
                        onClick={() => updateActiveTemplate((template) => ({
                          ...template,
                          sources: [...template.sources, { id: "", name: "", url: "", description: "" }],
                        }))}
                        className="btn-secondary flex items-center gap-2 text-xs"
                      >
                        <Plus size={14} /> {t("addSource")}
                      </button>
                    </div>
                    <div className="space-y-3">
                      {!activeTemplate.sources.length && <div className="rounded-xl bg-slate-50 p-8 text-sm text-slate-500">{t("noTemplateSources")}</div>}
                      {activeTemplate.sources.map((source, index) => (
                        <div key={source.id || source.url || `source-${index}`} className="rounded-xl border border-slate-200 p-4">
                          <div className="mb-3 flex justify-end">
                            <button
                              onClick={() => updateActiveTemplate((template) => ({
                                ...template,
                                sources: template.sources.filter((item) => item !== source),
                              }))}
                              className="rounded-lg border border-red-100 px-3 py-2 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <Field label={t("sourceName")}>
                              <input
                                value={source.name}
                                onChange={(event) => updateActiveTemplate((template) => ({
                                  ...template,
                                  sources: template.sources.map((item) => item === source ? { ...item, name: event.target.value } : item),
                                }))}
                                className="field"
                              />
                            </Field>
                            <Field label="URL">
                              <input
                                value={source.url}
                                onChange={(event) => updateActiveTemplate((template) => ({
                                  ...template,
                                  sources: template.sources.map((item) => item === source ? { ...item, url: event.target.value } : item),
                                }))}
                                className="field"
                              />
                            </Field>
                          </div>
                          <Field label={t("sourceDescription")}>
                            <textarea
                              value={source.description || ""}
                              onChange={(event) => updateActiveTemplate((template) => ({
                                ...template,
                                sources: template.sources.map((item) => item === source ? { ...item, description: event.target.value } : item),
                              }))}
                              className="field mt-4 min-h-24 resize-y"
                            />
                          </Field>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {message && (
                  <div className={`mt-5 rounded-lg p-3 text-sm ${message.includes("saved") || message.includes("kaydedildi") || message.includes("oluşturuldu") || message.includes("deleted") || message.includes("silindi") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {message}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold ${active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
      {icon}{label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}
