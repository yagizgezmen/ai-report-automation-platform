"use client";

import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Report, WorkspaceProfile } from "@/lib/types";
import { ArrowRight, CheckCircle2, Clock3, FilePlus2, FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { localizeReportType } from "@/lib/localization";

export default function Dashboard() {
  const { language, t } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [profile, setProfile] = useState<WorkspaceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => setProfile(payload))
      .catch(() => undefined);

    async function loadReports() {
      try {
        const response = await fetch("/api/reports");
        const payload: unknown = await response.json();

        if (!response.ok) {
          const message = typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Could not load reports.";
          setLoadError(message);
          setReports([]);
          return;
        }

        if (!Array.isArray(payload)) {
          setLoadError("Could not load reports.");
          setReports([]);
          return;
        }

        setLoadError(null);
        setReports(payload as Report[]);
      } catch {
        setLoadError("Could not load reports.");
        setReports([]);
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, []);

  const visible = reports.filter((report) => report.projectName.toLowerCase().includes(query.toLowerCase()));
  const firstName = profile?.fullName.trim().split(/\s+/)[0];
  const greeting = firstName ? `${t("greeting")}, ${firstName}` : t("greeting");
  const reportCounts = {
    all: reports.length,
    inProgress: reports.filter((report) => report.status === "In Progress").length,
    needsReview: reports.filter((report) => report.status === "Needs Review").length,
    completed: reports.filter((report) => report.status === "Completed").length,
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-[1400px] p-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[.14em] text-blue-600">{t("reportWorkspace")}</p>
            <h1 className="text-3xl font-bold tracking-tight">{greeting}</h1>
            <p className="mt-2 text-sm text-slate-500">{t("dashboardDescription")}</p>
          </div>
          <Link href="/reports/new" className="btn-primary flex items-center gap-2"><FilePlus2 size={17} /> {t("newReport")}</Link>
        </div>

        <div className="mb-7 grid grid-cols-4 gap-4">
          <Metric icon={<FileText size={19} />} label={t("allReports")} value={reportCounts.all} color="blue" />
          <Metric icon={<Clock3 size={19} />} label={t("inProgress")} value={reportCounts.inProgress} color="amber" />
          <Metric icon={<Sparkles size={19} />} label={t("needsReview")} value={reportCounts.needsReview} color="violet" />
          <Metric icon={<CheckCircle2 size={19} />} label={t("completed")} value={reportCounts.completed} color="emerald" />
        </div>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="font-bold">{t("recentReports")}</h2>
              <p className="mt-1 text-xs text-slate-500">{t("recentReportsDescription")}</p>
            </div>
            <div className="w-64">
              <input value={query} onChange={(e) => setQuery(e.target.value)} className="field py-2 text-sm" placeholder={t("searchReports")} />
            </div>
          </div>
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">{t("loadingReports")}</div>
          ) : loadError ? (
            <div className="p-12 text-center text-sm text-rose-600">{loadError}</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visible.map((report) => {
                const complete = report.sections.filter((s) => s.reviewStatus === "Approved" || s.reviewStatus === "Generated").length;
                const progress = Math.round((complete / report.sections.length) * 100);
                return (
                  <Link key={report.id} href={`/reports/${report.id}`} className="grid grid-cols-[2fr_1fr_1fr_1fr_30px] items-center gap-5 px-5 py-4 hover:bg-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><FileText size={19} /></div>
                      <div>
                        <div className="text-sm font-bold">{report.projectName}</div>
                        <div className="mt-1 text-xs text-slate-500">{localizeReportType(report.reportType, language)} · {report.location}</div>
                      </div>
                    </div>
                    <StatusBadge status={report.status} />
                    <div>
                      <div className="mb-1.5 flex justify-between text-[11px] text-slate-500"><span>{t("progress")}</span><span>{progress}%</span></div>
                      <div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} /></div>
                    </div>
                    <div className="text-xs text-slate-500">{new Date(report.updatedAt).toLocaleDateString(language === "tr" ? "tr-TR" : "en-US")}</div>
                    <ArrowRight size={16} className="text-slate-400" />
                  </Link>
                );
              })}
              {!visible.length && <div className="p-12 text-center text-sm text-slate-500">{t("noReports")}</div>}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}

function Metric({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600", emerald: "bg-emerald-50 text-emerald-600",
  };
  return <div className="card flex items-center gap-4 p-5"><div className={`rounded-xl p-3 ${colors[color]}`}>{icon}</div><div><div className="text-2xl font-bold">{value}</div><div className="text-xs text-slate-500">{label}</div></div></div>;
}
