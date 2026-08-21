"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/context/AppProvider";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

const LAST_EXPORT_KEY = "recipe-app-last-export-v1";
const EXPORT_REMINDER_DAYS = 30;

function buildExportPayload(app: {
  recipes: unknown;
  labels: unknown;
  folders: unknown;
  plannerConfig: unknown;
  mealPlan: unknown;
  cookLog: unknown;
}) {
  return {
    exportedAt: new Date().toISOString(),
    exportFormatVersion: 1,
    recipes: app.recipes,
    labels: app.labels,
    folders: app.folders,
    plannerConfig: app.plannerConfig,
    mealPlan: app.mealPlan,
    cookLog: app.cookLog,
  };
}

function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function AccountSettings({ userEmail }: { userEmail: string | undefined }) {
  const router = useRouter();
  const { recipes, labels, folders, plannerConfig, mealPlan, cookLog, syncStatus } = useApp();
  const [lastExportedAt, setLastExportedAt] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    try {
      setLastExportedAt(localStorage.getItem(LAST_EXPORT_KEY));
    } catch {
      setLastExportedAt(null);
    }
  }, []);

  const daysSinceExport = lastExportedAt
    ? Math.floor((Date.now() - new Date(lastExportedAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const shouldNudge = daysSinceExport === null || daysSinceExport >= EXPORT_REMINDER_DAYS;

  function handleExport() {
    const payload = buildExportPayload({ recipes, labels, folders, plannerConfig, mealPlan, cookLog });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(payload, `kitchen-library-export-${stamp}.json`);
    try {
      const now = new Date().toISOString();
      localStorage.setItem(LAST_EXPORT_KEY, now);
      setLastExportedAt(now);
    } catch {
      // localStorage unavailable — the export itself still succeeded.
    }
  }

  async function handleSignOut() {
    const supabase = getSupabase();
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-[#e5e5ea]">
        <Link href="/" className="text-sm text-[#0071e3] hover:underline">
          ← Back
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-[#1d1d1f]">
          Account &amp; Settings
        </h1>
        {userEmail ? (
          <p className="mt-2 text-sm text-[#86868b]">Signed in as {userEmail}</p>
        ) : null}
        <p className="mt-1 text-xs text-[#c7c7cc]">
          {syncStatus === "syncing" || syncStatus === "local"
            ? "Syncing…"
            : syncStatus === "offline"
              ? "Offline — changes are saved on this device and will sync when reconnected"
              : syncStatus === "conflict"
                ? "Another device saved more recently — this device just reloaded the latest copy"
                : "Synced"}
        </p>

        <div className="mt-6 rounded-xl border border-[#e5e5ea] p-4">
          <p className="text-sm font-medium text-[#1d1d1f]">Export my data</p>
          <p className="mt-1 text-sm text-[#86868b]">
            Downloads every recipe, folder, label, planner setting, meal plan, and your
            full cook history as one JSON file — a personal backup you control, separate
            from cloud sync.
          </p>
          {shouldNudge ? (
            <p className="mt-3 rounded-lg bg-[#fff8ec] px-3 py-2 text-xs text-[#8a6d1a]">
              {lastExportedAt
                ? `It's been ${daysSinceExport} days since your last export — worth doing another.`
                : "You haven't exported a backup yet."}
            </p>
          ) : (
            <p className="mt-3 text-xs text-[#86868b]">
              Last exported {daysSinceExport === 0 ? "today" : `${daysSinceExport} day${daysSinceExport === 1 ? "" : "s"} ago`}.
            </p>
          )}
          <button
            type="button"
            onClick={handleExport}
            className="mt-3 w-full rounded-xl bg-[#0071e3] py-2.5 text-sm font-semibold text-white hover:bg-[#0077ed]"
          >
            Download export (.json)
          </button>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-6 w-full rounded-xl border border-[#e5e5ea] py-2.5 text-sm font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { user } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg text-[#1d1d1f]">Cloud sync is not set up yet</p>
        <p className="max-w-sm text-sm text-[#86868b]">
          Add Supabase keys to <code className="text-[#515154]">.env.local</code>{" "}
          (see <code className="text-[#515154]">.env.example</code>).
        </p>
        <Link href="/" className="text-[#0071e3]">
          Back home
        </Link>
      </div>
    );
  }

  if (user) {
    return <AccountSettings userEmail={user.email} />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = getSupabase();
    if (!supabase) {
      setError("Cloud sync is not configured.");
      setLoading(false);
      return;
    }

    const action =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

    const { error: authError } = await action;
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-[#e5e5ea]">
        <Link href="/" className="text-sm text-[#0071e3] hover:underline">
          ← Back
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-[#1d1d1f]">
          {mode === "signin" ? "Sign in to sync" : "Create account"}
        </h1>
        <p className="mt-2 text-sm text-[#86868b]">
          Use the same account on your PC, iPhone, and iPad so recipes stay in
          sync.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#515154]">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#e5e5ea] px-4 py-2.5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#515154]">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#e5e5ea] px-4 py-2.5"
            />
          </div>
          {error ? (
            <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#0071e3] py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
        <button
          type="button"
          onClick={() =>
            setMode(mode === "signin" ? "signup" : "signin")
          }
          className="mt-4 w-full text-sm text-[#0071e3]"
        >
          {mode === "signin"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
