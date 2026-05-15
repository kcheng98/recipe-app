"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
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
