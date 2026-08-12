"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useLanguage } from "@/components/language-provider";
import { WorkspaceProfile } from "@/lib/types";
import { KeyRound, Save, ShieldCheck, UserRound } from "lucide-react";

const emptyPasswordState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function ProfileSettingsPage() {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<WorkspaceProfile | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    title: "",
    email: "",
    phone: "",
    username: "",
  });
  const [passwordForm, setPasswordForm] = useState(emptyPasswordState);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [error, setError] = useState("");
  const [passwordFieldError, setPasswordFieldError] = useState("");

  function localizePasswordError(body: unknown) {
    const payload = body as { error?: string; details?: Record<string, string[] | undefined> } | null;
    const details = payload?.details;

    const currentPasswordError = details?.currentPassword?.[0];
    if (currentPasswordError) {
      return currentPasswordError.toLowerCase().includes("required") ? t("fieldRequired") : currentPasswordError;
    }

    const newPasswordError = details?.newPassword?.[0];
    if (newPasswordError) {
      if (newPasswordError.toLowerCase().includes("at least 8") || newPasswordError.toLowerCase().includes("too small")) {
        return t("passwordRuleMinLength");
      }
      return newPasswordError.toLowerCase().includes("required") ? t("fieldRequired") : newPasswordError;
    }

    const confirmPasswordError = details?.confirmPassword?.[0];
    if (confirmPasswordError) {
      if (confirmPasswordError.toLowerCase().includes("does not match")) {
        return t("passwordConfirmationMismatch");
      }
      return confirmPasswordError.toLowerCase().includes("required") ? t("fieldRequired") : confirmPasswordError;
    }

    if (payload?.error === "Invalid request data.") return t("invalidRequestData");
    if (payload?.error === "Current password is incorrect.") return t("currentPasswordIncorrect");
    return payload?.error || t("passwordUpdateError");
  }

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch("/api/profile");
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || t("profileLoadError"));
        setProfile(body);
        setForm({
          fullName: body.fullName,
          title: body.title,
          email: body.email,
          phone: body.phone,
          username: body.username,
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t("profileLoadError"));
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [t]);

  const initials = useMemo(() => {
    const value = form.fullName.trim();
    if (!value) return "PR";
    return value.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
  }, [form.fullName]);

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage("");
    setError("");
    setPasswordFieldError("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || t("profileUpdateError"));
      setProfile(body);
      setForm({
        fullName: body.fullName,
        title: body.title,
        email: body.email,
        phone: body.phone,
        username: body.username,
      });
      setProfileMessage(t("profileUpdated"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("profileUpdateError"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordMessage("");
    setError("");
    setPasswordFieldError("");
    try {
      const response = await fetch("/api/profile/credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });
      const body = await response.json();
      if (!response.ok) {
        const message = localizePasswordError(body);
        setPasswordFieldError(message);
        throw new Error(message);
      }
      setPasswordForm(emptyPasswordState);
      setPasswordMessage(t("passwordUpdated"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("passwordUpdateError"));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-[1280px] p-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[.14em] text-blue-600">{t("profile")}</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("workspaceAccount")}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">{t("profileDescription")}</p>
          </div>
        </div>

        {error && <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#172a4d] text-2xl font-bold text-white">{initials}</div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{form.fullName || "Workspace User"}</h2>
                <p className="mt-1 text-sm text-slate-500">{form.title || t("title")}</p>
              </div>
            </div>
            <div className="mt-8 space-y-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-400">{t("username")}</div>
                <div className="mt-1 font-medium text-slate-900">{form.username || "-"}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-400">{t("email")}</div>
                <div className="mt-1 font-medium text-slate-900">{form.email || "-"}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-400">{t("phone")}</div>
                <div className="mt-1 font-medium text-slate-900">{form.phone || "-"}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-400">{t("updated")}</div>
                <div className="mt-1 font-medium text-slate-900">{profile ? new Date(profile.updatedAt).toLocaleString("tr-TR") : "-"}</div>
              </div>
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-600"><UserRound size={18} /></div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{t("personalInformation")}</h2>
                  <p className="text-sm text-slate-500">{t("personalInformationDescription")}</p>
                </div>
              </div>

              {loading ? <div className="text-sm text-slate-500">{t("profileLoading")}</div> : (
                <form className="grid gap-4 md:grid-cols-2" onSubmit={submitProfile}>
                  <Field label={t("fullName")} value={form.fullName} onChange={(value) => setForm((current) => ({ ...current, fullName: value }))} />
                  <Field label={t("title")} value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
                  <Field label={t("email")} type="email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
                  <Field label={t("phone")} value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
                  <Field label={t("username")} value={form.username} onChange={(value) => setForm((current) => ({ ...current, username: value }))} />
                  <div className="md:col-span-2 flex items-center justify-between pt-2">
                    <div className="text-sm text-emerald-700">{profileMessage}</div>
                    <button type="submit" disabled={savingProfile} className="btn-primary flex items-center gap-2">
                      <Save size={15} /> {savingProfile ? t("savingProfile") : t("saveProfile")}
                    </button>
                  </div>
                </form>
              )}
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-2xl bg-amber-50 p-3 text-amber-600"><KeyRound size={18} /></div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{t("security")}</h2>
                  <p className="text-sm text-slate-500">{t("securityDescription")}</p>
                </div>
              </div>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={submitPassword}>
                <Field label={t("currentPassword")} type="password" value={passwordForm.currentPassword} onChange={(value) => setPasswordForm((current) => ({ ...current, currentPassword: value }))} />
                <div />
                <Field label={t("newPassword")} type="password" value={passwordForm.newPassword} onChange={(value) => setPasswordForm((current) => ({ ...current, newPassword: value }))} error={passwordFieldError} hint={`${t("passwordRuleMinLength")} ${t("passwordRuleMatch")} ${t("passwordRuleCurrent")}`} />
                <Field label={t("confirmNewPassword")} type="password" value={passwordForm.confirmPassword} onChange={(value) => setPasswordForm((current) => ({ ...current, confirmPassword: value }))} />
                <div className="md:col-span-2 flex items-center justify-between pt-2">
                  <div className="text-sm text-emerald-700">{passwordMessage}</div>
                  <button type="submit" disabled={savingPassword} className="btn-secondary flex items-center gap-2">
                    <ShieldCheck size={15} /> {savingPassword ? t("updatingPassword") : t("updatePassword")}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </main>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  hint,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-blue-500 ${error ? "border-rose-300" : "border-slate-200"}`}
      />
      {error ? <span className="mt-1.5 block text-sm text-rose-600">{error}</span> : null}
      {hint ? <span className="mt-1.5 block text-xs leading-5 text-slate-500">{hint}</span> : null}
    </label>
  );
}