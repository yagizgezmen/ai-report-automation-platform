"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Loader2, Sparkles } from "lucide-react";
import { useLanguage } from "@/components/language-provider";

export function LoginPageClient({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function localizeLoginError(message?: string) {
    if (message === "Invalid username or password.") return t("invalidUsernameOrPassword");
    if (message === "Authentication is not configured.") return message;
    return message || t("loginFailed");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, next: nextPath }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(localizeLoginError(body.error));
        return;
      }

      router.push(body.redirectTo || nextPath);
      router.refresh();
    } catch {
      setError(t("loginRequestFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_40%,_#e2e8f0)] px-6 py-12">
      <div className="mx-auto flex min-h-[80vh] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)] md:grid-cols-[1.1fr_0.9fr]">
          <section className="hidden bg-[#172a4d] p-10 text-white md:block">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500"><Sparkles size={20} /></div>
              <div>
                <div className="text-lg font-bold">Arqive AI</div>
                <div className="text-xs uppercase tracking-[.18em] text-blue-200">{t("secureWorkspace")}</div>
              </div>
            </div>
            <h1 className="mt-16 max-w-sm text-4xl font-bold leading-tight">{t("loginTitle")}</h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-blue-100">
              {t("loginWorkspaceDescription")}
            </p>
          </section>
          <section className="p-8 md:p-10">
            <div className="mx-auto max-w-md">
              <div className="mb-8 flex items-center gap-3 md:hidden">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#172a4d] text-white"><Sparkles size={18} /></div>
                <div>
                  <div className="text-base font-bold text-slate-900">Arqive AI</div>
                  <div className="text-xs uppercase tracking-[.16em] text-slate-400">{t("secureWorkspace")}</div>
                </div>
              </div>
              <div className="mb-8">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[.14em] text-slate-500">
                  <LockKeyhole size={13} /> {t("authentication")}
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">{t("signIn")}</h2>
                <p className="mt-2 text-sm text-slate-500">{t("loginDescription")}</p>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">{t("username")}</span>
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                    autoComplete="username"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">{t("currentPassword")}</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                    autoComplete="current-password"
                  />
                </label>

                {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#172a4d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#203861] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <LockKeyhole size={16} />}
                  {submitting ? t("signingIn") : t("signIn")}
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}