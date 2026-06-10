"use client";

import { Bell, BookOpen, FileText, LayoutDashboard, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageSelector, useLanguage } from "@/components/language-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 w-[230px] bg-[#172a4d] text-white">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500"><Sparkles size={18} /></div>
          <div>
            <div className="text-[17px] font-bold tracking-tight">Arqive AI</div>
            <div className="text-[10px] uppercase tracking-[.16em] text-blue-200">{t("reportIntelligence")}</div>
          </div>
        </div>
        <nav className="space-y-1 p-4 text-sm">
          <Nav href="/" active={pathname === "/"} icon={<LayoutDashboard size={17} />} label={t("dashboard")} />
          <Nav href="/" active={false} icon={<FileText size={17} />} label={t("reports")} />
          <Nav href="/" active={false} icon={<BookOpen size={17} />} label={t("knowledgeBase")} />
          <Nav href="/settings/report-sources" active={pathname === "/settings/report-sources"} icon={<Settings size={17} />} label={t("sourceSettings")} />
        </nav>
        <div className="absolute bottom-0 w-full border-t border-white/10 p-4">
          <div className="mb-4 flex items-center gap-3 rounded-lg bg-white/5 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-400 text-xs font-bold">AY</div>
            <div className="min-w-0">
              <div className="truncate text-xs font-bold">Ayşe Yılmaz</div>
              <div className="truncate text-[10px] text-blue-200">{t("seniorConsultant")}</div>
            </div>
          </div>
          <Link href="/settings/report-sources" className="flex items-center gap-3 text-xs text-blue-100"><Settings size={16} /> {t("workspaceSettings")}</Link>
        </div>
      </aside>
      <div className="ml-[230px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-end border-b border-[#e6e9ef] bg-white px-7">
          <div className="flex items-center gap-5">
            <LanguageSelector />
            <button aria-label={t("notifications")} className="text-slate-500"><Bell size={19} /></button>
            <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
              {t("aiOperational")}
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

function Nav({ href, active, icon, label }: { href: string; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${active ? "bg-white/12 font-bold" : "text-blue-100 hover:bg-white/5"}`}>
      {icon}{label}
    </Link>
  );
}
