"use client";

/**
 * components/planner/PlannerOnboarding.tsx
 *
 * 3-step modal wizard that collects the user's PlannerConfig on first use
 * (or when they re-open it via "Adjust Planner").
 *
 * Step 1 — Days per week   (number cards 3–7)
 * Step 2 — Protein targets (counters; sum must equal daysPerWeek)
 * Step 3 — Store tiers     (checkboxes; at least "Standard" required)
 *
 * On completion, calls setPlannerConfig() and then generateMealPlan() for
 * the current week so the user lands on a ready plan.
 */

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/context/AppProvider";
import type { PlannerConfig, ProteinTargets, StoreTier } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns ISO date string of the Monday of the current week */
function getCurrentWeekStart(): string {
  const today = new Date();
  const day = today.getDay(); // 0=Sun, 1=Mon, …
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

function proteinSum(targets: ProteinTargets): number {
  return (
    targets.poultry +
    targets["fish-seafood"] +
    targets["red-meat"] +
    targets.vegetarianVegan
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`block rounded-full transition-all duration-200 ${
            i === current
              ? "w-6 h-2 bg-orange-500"
              : i < current
              ? "w-2 h-2 bg-orange-300"
              : "w-2 h-2 bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

function Counter({
  label,
  emoji,
  value,
  onIncrement,
  onDecrement,
  canIncrement,
  canDecrement,
}: {
  label: string;
  emoji: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  canIncrement: boolean;
  canDecrement: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-xl">{emoji}</span>
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onDecrement}
          disabled={!canDecrement}
          className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 font-semibold
                     flex items-center justify-center transition
                     hover:border-orange-400 hover:text-orange-500
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          −
        </button>
        <span className="w-4 text-center text-sm font-bold text-gray-800">{value}</span>
        <button
          onClick={onIncrement}
          disabled={!canIncrement}
          className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 font-semibold
                     flex items-center justify-center transition
                     hover:border-orange-400 hover:text-orange-500
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  /** Pass true to show the modal (first run or "Adjust Planner" button) */
  open: boolean;
  onClose: () => void;
}

export function PlannerOnboarding({ open, onClose }: Props) {
  const { setPlannerConfig, generateMealPlan } = useApp();

  const [step, setStep] = useState(0);
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [targets, setTargets] = useState<ProteinTargets>({
    poultry: 2,
    "fish-seafood": 1,
    "red-meat": 1,
    vegetarianVegan: 1,
  });
  const [enabledStores, setEnabledStores] = useState<StoreTier[]>(["Standard"]);

  // Reset to step 0 whenever the modal opens
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  // Whenever daysPerWeek changes, reset protein targets to a sensible default
  useEffect(() => {
    const base = Math.max(0, daysPerWeek - 4);
    setTargets({
      poultry: 2 + base,
      "fish-seafood": 1,
      "red-meat": 1,
      vegetarianVegan: Math.max(0, daysPerWeek - 4),
    });
  }, [daysPerWeek]);

  // ── Step 1: Days per week ──────────────────────────────────────────────────

  const renderStep1 = () => (
    <>
      <h2 className="text-lg font-bold text-gray-900 mb-1">
        How many dinners per week?
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        We'll fill this many slots in your weekly plan.
      </p>
      <div className="flex justify-center gap-3 flex-wrap mb-8">
        {[3, 4, 5, 6, 7].map((n) => (
          <button
            key={n}
            onClick={() => setDaysPerWeek(n)}
            className={`w-14 h-14 rounded-2xl text-lg font-bold transition-all
              ${
                daysPerWeek === n
                  ? "bg-orange-500 text-white shadow-md scale-105"
                  : "bg-gray-100 text-gray-600 hover:bg-orange-50"
              }`}
          >
            {n}
          </button>
        ))}
      </div>
    </>
  );

  // ── Step 2: Protein targets ────────────────────────────────────────────────

  const sum = proteinSum(targets);
  const remaining = daysPerWeek - sum;

  const adjust = useCallback(
    (key: keyof ProteinTargets, delta: number) => {
      setTargets((prev) => ({
        ...prev,
        [key]: Math.max(0, prev[key] + delta),
      }));
    },
    [],
  );

  const renderStep2 = () => (
    <>
      <h2 className="text-lg font-bold text-gray-900 mb-1">
        Protein mix this week
      </h2>
      <p className="text-sm text-gray-500 mb-1">
        Distribute your {daysPerWeek} dinners across protein types.
      </p>
      <div
        className={`text-xs font-semibold mb-4 transition-colors ${
          remaining === 0
            ? "text-green-600"
            : remaining < 0
            ? "text-red-500"
            : "text-orange-500"
        }`}
      >
        {remaining === 0
          ? "✓ Perfect — all slots assigned"
          : remaining > 0
          ? `${remaining} slot${remaining !== 1 ? "s" : ""} still unassigned`
          : `${Math.abs(remaining)} over limit — reduce a category`}
      </div>
      <div className="bg-gray-50 rounded-2xl px-4 py-1 mb-6">
        <Counter
          label="Poultry"
          emoji="🍗"
          value={targets.poultry}
          onIncrement={() => adjust("poultry", 1)}
          onDecrement={() => adjust("poultry", -1)}
          canIncrement={sum < daysPerWeek}
          canDecrement={targets.poultry > 0}
        />
        <Counter
          label="Fish & Seafood"
          emoji="🐟"
          value={targets["fish-seafood"]}
          onIncrement={() => adjust("fish-seafood", 1)}
          onDecrement={() => adjust("fish-seafood", -1)}
          canIncrement={sum < daysPerWeek}
          canDecrement={targets["fish-seafood"] > 0}
        />
        <Counter
          label="Red Meat"
          emoji="🥩"
          value={targets["red-meat"]}
          onIncrement={() => adjust("red-meat", 1)}
          onDecrement={() => adjust("red-meat", -1)}
          canIncrement={sum < daysPerWeek}
          canDecrement={targets["red-meat"] > 0}
        />
        <Counter
          label="Vegetarian / Vegan"
          emoji="🥦"
          value={targets.vegetarianVegan}
          onIncrement={() => adjust("vegetarianVegan", 1)}
          onDecrement={() => adjust("vegetarianVegan", -1)}
          canIncrement={sum < daysPerWeek}
          canDecrement={targets.vegetarianVegan > 0}
        />
      </div>
    </>
  );

  // ── Step 3: Store tiers ────────────────────────────────────────────────────

  const toggleStore = (tier: StoreTier) => {
    if (tier === "Standard") return; // always required, not toggleable
    setEnabledStores((prev) =>
      prev.includes(tier) ? prev.filter((s) => s !== tier) : [...prev, tier],
    );
  };

  const storeTiers: { tier: StoreTier; label: string; emoji: string; desc: string }[] = [
    {
      tier: "Standard",
      label: "Standard",
      emoji: "🛒",
      desc: "Fred Meyer, QFC, Safeway — always on",
    },
    {
      tier: "Asian",
      label: "Asian Market",
      emoji: "🏮",
      desc: "H Mart, Uwajimaya, 99 Ranch",
    },
    {
      tier: "Premium",
      label: "Premium",
      emoji: "✨",
      desc: "Whole Foods, PCC, specialty delis",
    },
  ];

  const renderStep3 = () => (
    <>
      <h2 className="text-lg font-bold text-gray-900 mb-1">
        Where are you shopping?
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Only recipes you can source will be recommended.
      </p>
      <div className="flex flex-col gap-3 mb-6">
        {storeTiers.map(({ tier, label, emoji, desc }) => {
          const checked = enabledStores.includes(tier);
          const locked = tier === "Standard";
          return (
            <button
              key={tier}
              onClick={() => toggleStore(tier)}
              disabled={locked}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition border
                ${
                  checked
                    ? "border-orange-400 bg-orange-50"
                    : "border-gray-200 bg-gray-50 hover:border-orange-200"
                }
                ${locked ? "cursor-default" : "cursor-pointer"}`}
            >
              <span className="text-2xl">{emoji}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition
                  ${checked ? "border-orange-500 bg-orange-500" : "border-gray-300"}`}
              >
                {checked && (
                  <svg viewBox="0 0 10 8" className="w-3 h-3 fill-white">
                    <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );

  // ── Navigation & submit ────────────────────────────────────────────────────

  const canAdvance = () => {
    if (step === 1) return sum === daysPerWeek;
    return true;
  };

  const handleNext = () => {
    if (step < 2) {
      setStep((s) => s + 1);
    } else {
      const config: PlannerConfig = { daysPerWeek, proteinTargets: targets, enabledStores };
      setPlannerConfig(config);
      generateMealPlan(getCurrentWeekStart());
      onClose();
    }
  };

  if (!open) return null;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        // Only close on backdrop click if we're in "adjust" mode (config already set)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Sheet */}
      <div
        className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl px-6 pt-6 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5 sm:hidden" />

        <StepDots current={step} total={3} />

        {step === 0 && renderStep1()}
        {step === 1 && renderStep2()}
        {step === 2 && renderStep3()}

        {/* Buttons */}
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold
                         text-gray-600 hover:bg-gray-50 transition"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canAdvance()}
            className="flex-1 py-3 rounded-2xl bg-orange-500 text-white text-sm font-bold
                       shadow-sm transition hover:bg-orange-600
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {step < 2 ? "Next" : "Build my plan →"}
          </button>
        </div>
      </div>
    </div>
  );
}
