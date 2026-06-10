"use client";

import { AppShell } from "@/components/app-shell";
import { useLanguage } from "@/components/language-provider";
import { localizeReportType } from "@/lib/localization";
import { reportTypes } from "@/lib/report-types";
import { Globe2, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function ReportSourcesSettingsPage() {
  const { language, t } = useLanguage();
  const [reportType, setReportType] = useState<string>(reportTypes[0]);
  const [urls, setUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setBusy("load");
    setMessage("");
    fetch(`/api/report-type-sources?reportType=${encodeURIComponent(reportType)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setUrls(body.map((item: { url: string }) => item.url));
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setBusy(""));
  }, [reportType]);

  async function save() {
    setBusy("save");
    setMessage("");
    const response = await fetch("/api/report-type-sources", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportType,
        urls: urls.map((url) => url.trim()).filter(Boolean),
      }),
    });
    const body = await response.json();
    if (response.ok) {
      setUrls(body.map((item: { url: string }) => item.url));
      setMessage(t("reportSourcesSaved"));
    } else {
      setMessage(body.error || t("reportSourcesSaveError"));
    }
    setBusy("");
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-[900px] p-8">
        <div className="mb-7">
          <p className="mb-1 text-xs font-bold uppercase tracking-[.14em] text-blue-600">{t("settings")}</p>
          <h1 className="text-3xl font-bold tracking-tight">{t("reportSourcesTitle")}</h1>
          <p className="mt-2 text-sm text-slate-500">{t("reportSourcesDescription")}</p>
        </div>

        <section className="card p-6">
          <label>
            <span className="label">{t("reportType")}</span>
            <select value={reportType} onChange={(event) => setReportType(event.target.value)} className="field">
              {reportTypes.map((type) => (
                <option key={type} value={type}>{localizeReportType(type, language)}</option>
              ))}
            </select>
          </label>

          <div className="my-6 border-t border-slate-100" />
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-bold">{t("defaultSources")}</h2>
              <p className="mt-1 text-xs text-slate-500">{t("defaultSourcesHelp")}</p>
            </div>
            <button
              onClick={() => setUrls((items) => [...items, ""])}
              className="btn-secondary flex items-center gap-2 text-xs"
            >
              <Plus size={14} /> {t("addSourceUrl")}
            </button>
          </div>

          {busy === "load" ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> {t("loadingSources")}</div>
          ) : (
            <div className="space-y-3">
              {urls.map((url, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3">
                    <Globe2 size={15} className="text-blue-600" />
                    <input
                      value={url}
                      onChange={(event) => setUrls((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                      className="w-full border-0 py-3 text-sm outline-none"
                      placeholder="https://..."
                    />
                  </div>
                  <button
                    aria-label={t("deleteSource")}
                    onClick={() => setUrls((items) => items.filter((_, itemIndex) => itemIndex !== index))}
                    className="rounded-lg border border-red-100 px-3 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {!urls.length && <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">{t("noDefaultSources")}</div>}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <span className={`text-xs ${message.includes("kaydedildi") || message.includes("saved") ? "text-emerald-700" : "text-red-600"}`}>{message}</span>
            <button onClick={save} disabled={Boolean(busy)} className="btn-primary flex items-center gap-2">
              {busy === "save" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {t("saveSources")}
            </button>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
