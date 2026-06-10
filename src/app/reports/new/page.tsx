"use client";

import { AppShell } from "@/components/app-shell";
import { ArrowLeft, ArrowRight, Check, FileText, Loader2, MapPin, SlidersHorizontal, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { ReportType } from "@/lib/types";

export default function NewReportPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [error, setError] = useState("");
  const [allowWebResearch, setAllowWebResearch] = useState(false);
  const [reportTypes, setReportTypes] = useState<ReportType[]>([]);
  const [selectedReportTypeId, setSelectedReportTypeId] = useState("");

  useEffect(() => {
    fetch("/api/report-types")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Rapor türleri yüklenemedi.");
        const availableTemplates = body.filter((template: ReportType) =>
          template.sections.length > 0 || template.sources.length > 0 || template.description,
        );
        setReportTypes(availableTemplates);
        setSelectedReportTypeId((current) => current || availableTemplates[0]?.id || "");
      })
      .catch((caught) => setError(caught.message))
      .finally(() => setLoadingTypes(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data);
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        desiredLength: Number(payload.desiredLength),
        allowWebResearch,
      }),
    });
    const body = await response.json();
    if (!response.ok) { setError(body.error || "Rapor oluşturulamadı."); setSaving(false); return; }
    router.push(`/reports/${body.id}`);
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-[1050px] p-8">
        <Link href="/" className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-500"><ArrowLeft size={16} /> {t("backToDashboard")}</Link>
        <div className="mb-7">
          <p className="mb-1 text-xs font-bold uppercase tracking-[.14em] text-blue-600">{t("newReportEyebrow")}</p>
          <h1 className="text-3xl font-bold tracking-tight">{t("newReportTitle")}</h1>
          <p className="mt-2 text-sm text-slate-500">{t("newReportDescription")}</p>
        </div>
        <form onSubmit={submit} className="grid grid-cols-[1fr_290px] gap-6">
          <div className="space-y-5">
            <FormSection icon={<FileText size={18} />} title={t("reportDetails")}>
              <div className="grid grid-cols-2 gap-4">
                <Field label={t("reportType")}>
                  <select name="reportTypeId" className="field" required value={selectedReportTypeId} onChange={(event) => setSelectedReportTypeId(event.target.value)}>
                    {reportTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </select>
                </Field>
                <Field label={t("projectName")}><input name="projectName" className="field" placeholder={t("projectPlaceholder")} required /></Field>
              </div>
            </FormSection>
            <FormSection icon={<MapPin size={18} />} title={t("locationParcel")}>
              <div className="grid grid-cols-3 gap-4">
                <Field label={t("city")}><input name="city" className="field" placeholder="İstanbul" required /></Field>
                <Field label={t("district")}><input name="district" className="field" placeholder="Kadıköy" /></Field>
                <Field label={t("neighborhood")}><input name="neighborhood" className="field" placeholder="Fenerbahçe" /></Field>
              </div>
              <Field label={t("parcelInfo")}><input name="parcelInfo" className="field" placeholder={t("parcelPlaceholder")} /></Field>
            </FormSection>
            <FormSection icon={<Sparkles size={18} />} title={t("aiSettings")}>
              <p className="text-sm leading-6 text-slate-500">{t("aiSettingsDescription")}</p>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="pr-4">
                  <span className="block text-sm font-bold text-slate-800">{t("allowWebResearch")}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{t("allowWebResearchHelp")}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={allowWebResearch}
                  onClick={() => setAllowWebResearch((value) => !value)}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${allowWebResearch ? "bg-blue-600" : "bg-slate-300"}`}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white transition ${allowWebResearch ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </FormSection>
            <FormSection icon={<SlidersHorizontal size={18} />} title={t("outputPreferences")}>
              <div className="grid grid-cols-2 gap-4">
                <Field label={t("outputLanguage")}><select name="outputLanguage" className="field" defaultValue="Turkish"><option value="Turkish">{t("turkish")}</option><option value="English">{t("english")}</option></select></Field>
                <Field label={t("desiredLength")}><select name="desiredLength" className="field">{[40, 60, 65, 70].map((count) => <option key={count} value={count}>{t("pagesApprox", { count })}</option>)}</select></Field>
              </div>
            </FormSection>
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="flex justify-end">
              <button disabled={saving || loadingTypes || !reportTypes.length} className="btn-primary flex items-center gap-2 px-6">
                {saving ? t("creatingWorkspace") : t("createReport")} <ArrowRight size={16} />
              </button>
            </div>
          </div>
          <aside>
            <div className="card sticky top-24 p-5">
              <div className="mb-4 rounded-xl bg-blue-50 p-4 text-blue-700"><FileText size={24} /></div>
              <h3 className="font-bold">{t("whatNext")}</h3>
              <div className="mt-5 space-y-4">
                {[t("nextTemplate"), t("nextConfiguredSources"), t("nextFiles"), t("nextGenerate")].map((text) => (
                  <div key={text} className="flex gap-3 text-xs leading-5 text-slate-600"><Check size={15} className="mt-0.5 shrink-0 text-emerald-600" />{text}</div>
                ))}
              </div>
              <div className="mt-6 border-t border-slate-100 pt-4 text-[11px] leading-5 text-slate-500">
                {t("manualReviewNote")}
              </div>
            </div>
          </aside>
        </form>
        {loadingTypes && <div className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> {t("loadingTemplates")}</div>}
      </main>
    </AppShell>
  );
}

function FormSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="card p-6"><div className="mb-5 flex items-center gap-3"><div className="rounded-lg bg-slate-100 p-2 text-slate-600">{icon}</div><h2 className="font-bold">{title}</h2></div><div className="space-y-4">{children}</div></section>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="label">{label}</span>{children}</label>;
}
