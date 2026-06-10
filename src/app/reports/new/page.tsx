"use client";

import { AppShell } from "@/components/app-shell";
import { ArrowLeft, ArrowRight, Check, FileText, Globe2, MapPin, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { reportTypes } from "@/lib/report-types";
import { localizeReportType } from "@/lib/localization";

export default function NewReportPage() {
  const { language, t } = useLanguage();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [allowWebResearch, setAllowWebResearch] = useState(false);

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
                <Field label={t("reportType")}><select name="reportType" className="field" required>{reportTypes.map((type) => <option key={type} value={type}>{localizeReportType(type, language)}</option>)}</select></Field>
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
            <FormSection icon={<Globe2 size={18} />} title={t("sourcesContext")}>
              <Field label={t("companyNotes")}><textarea name="manualNotes" className="field min-h-28 resize-y" placeholder={t("companyNotesPlaceholder")} /></Field>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={allowWebResearch}
                  onChange={(event) => setAllowWebResearch(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-blue-600"
                />
                <span>
                  <span className="block text-sm font-bold text-slate-800">{t("allowWebResearch")}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{t("allowWebResearchHelp")}</span>
                </span>
              </label>
            </FormSection>
            <FormSection icon={<SlidersHorizontal size={18} />} title={t("outputPreferences")}>
              <div className="grid grid-cols-2 gap-4">
                <Field label={t("outputLanguage")}><select name="outputLanguage" className="field" defaultValue="Turkish"><option value="Turkish">{t("turkish")}</option><option value="English">{t("english")}</option></select></Field>
                <Field label={t("desiredLength")}><select name="desiredLength" className="field">{[40, 60, 65, 70].map((count) => <option key={count} value={count}>{t("pagesApprox", { count })}</option>)}</select></Field>
              </div>
            </FormSection>
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="flex justify-end">
              <button disabled={saving} className="btn-primary flex items-center gap-2 px-6">{saving ? t("creatingWorkspace") : t("createReport")} <ArrowRight size={16} /></button>
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
