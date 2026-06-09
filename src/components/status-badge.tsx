import { ReportStatus } from "@/lib/types";
import { useLanguage } from "@/components/language-provider";

const styles: Record<ReportStatus, string> = {
  Draft: "bg-slate-100 text-slate-600",
  "In Progress": "bg-blue-50 text-blue-700",
  "Needs Review": "bg-amber-50 text-amber-700",
  Completed: "bg-emerald-50 text-emerald-700",
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  const { t } = useLanguage();
  const labels: Record<ReportStatus, ReturnType<typeof t>> = {
    Draft: t("draft"), "In Progress": t("inProgress"),
    "Needs Review": t("needsReview"), Completed: t("completed"),
  };
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[status]}`}>{labels[status]}</span>;
}
