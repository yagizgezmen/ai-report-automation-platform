"use client";

import { Bell, BookOpen, FileText, LayoutDashboard, LogOut, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LanguageSelector, useLanguage } from "@/components/language-provider";
import { WorkspaceProfile } from "@/lib/types";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [signingOut, setSigningOut] = useState(false);
  const [profile, setProfile] = useState<WorkspaceProfile | null>(null);
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then((response) => response.ok ? response.json() : null)
      .then((body) => setProfile(body))
      .catch(() => undefined);
  }, []);

  const initials = useMemo(() => {
    const fullName = profile?.fullName?.trim();
    if (!fullName) return "PR";
    return fullName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
  }, [profile]);

  async function signOut() {
    setSigningOut(true);
    setSignOutError("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || t("signOutError"));
      }

      window.location.assign("/login");
      return;
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : t("signOutError"));
    } finally {
      setSigningOut(false);
    }
  }

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
          <Nav href="/settings/report-templates" active={pathname.startsWith("/settings/report-templates") || pathname.startsWith("/settings/report-sources")} icon={<Settings size={17} />} label={t("templateSettings")} />
        </nav>
        <div className="absolute bottom-0 w-full border-t border-white/10 p-4">
          <Link href="/settings/profile" className="mb-4 flex items-center gap-3 rounded-lg bg-white/5 p-3 transition hover:bg-white/10">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-400 text-xs font-bold">{initials}</div>
            <div className="min-w-0">
              <div className="truncate text-xs font-bold">{profile?.fullName || "Workspace User"}</div>
              <div className="truncate text-[10px] text-blue-200">{profile?.title || t("seniorConsultant")}</div>
            </div>
          </Link>
          <div className="space-y-2">
            <Link href="/settings/report-templates" className="flex items-center gap-3 text-xs text-blue-100"><Settings size={16} /> {t("workspaceSettings")}</Link>
          </div>
        </div>
      </aside>
      <div className="ml-[230px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-end border-b border-[#e6e9ef] bg-white px-7">
          <div className="flex items-center gap-5">
            <LanguageSelector />
            <button onClick={signOut} className="flex items-center gap-2 text-xs font-semibold text-slate-500" disabled={signingOut}>
              <LogOut size={16} /> {signingOut ? t("signingOut") : t("signOut")}
            </button>
            <button aria-label={t("notifications")} className="text-slate-500"><Bell size={19} /></button>
            <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
              {t("aiOperational")}
            </div>
          </div>
        </header>
        {signOutError ? <div className="border-b border-rose-200 bg-rose-50 px-7 py-3 text-sm text-rose-700">{signOutError}</div> : null}
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
