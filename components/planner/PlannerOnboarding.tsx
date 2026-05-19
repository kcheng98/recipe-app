"use client";

/**
 * components/planner/PlannerOnboarding.tsx
 *
 * Single-page scrollable config sheet (replaces 3-step wizard).
 * Sections visible simultaneously: days, protein counters, store checkboxes.
 * Submit button at the bottom generates the plan immediately.
 */

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/context/AppProvider";
import type { PlannerConfig, ProteinTargets, StoreTier } from "@/lib/types";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function proteinSum(targets: ProteinTargets): number {
  return (
    targets.poultry +
    targets["fish-seafood"] +
    targets["red-meat"] +
    targets.vegetarianVegan
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

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PlannerOnboarding({ open, onClose }: Props) {
  const { setPlannerConfig, generateMealPlan } = useApp();

  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [daysInput, setDaysInput] = useState("5");
  const [targets, setTargets] = useState<ProteinTargets>({
    poultry: 2,
    "fish-seafood": 1,
    "red-meat": 1,
    vegetarianVegan: 1,
  });
  const [enabledStores, setEnabledStores] = useState<StoreTier[]>(["Standard"]);

  // Keep daysInput in sync when daysPerWeek changes programmatically
  useEffect(() => {
    setDaysInput(String(daysPerWeek));
  }, [daysPerWeek]);

  // Reset defaults whenever modal opens
  useEffect(() => {
    if (open) {
      setDaysPerWeek(5);
      setDaysInput("5");
      setTargets({ poultry: 2, "fish-seafood": 1, "red-meat": 1, vegetarianVegan: 1 });
      setEnabledStores(["Standard"]);
    }
  }, [open]);

  const handleDaysBlur = () => {
    const n = Math.min(7, Math.max(0, parseInt(daysInput) || 0));
    setDaysPerWeek(n);
    setDaysInput(String(n));
  };

  const adjust = useCallback((key: keyof ProteinTargets, delta: number) => {
    setTargets((prev) => ({ ...prev, [key]: Math.max(0, prev[key] + delta) }));
  }, []);

  const toggleStore = (tier: StoreTier) => {
    if (tier === "Standard") return;
    setEnabledStores((prev) =>
      prev.includes(tier) ? prev.filter((s) => s !== tier) : [...prev, tier],
    );
  };

  const sum = proteinSum(targets);
  const remaining = daysPerWeek - sum;
  const canSubmit = remaining === 0 && daysPerWeek > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const config: PlannerConfig = { daysPerWeek, proteinTargets: targets, enabledStores };
    setPlannerConfig(config);
    generateMealPlan(todayISO());
    onClose();
  };

  const storeTiers: { tier: StoreTier; label: string; emoji: string; desc: string }[] = [
    { tier: "Standard", label: "Standard", emoji: "🛒", desc: "Trader Joe's, QFC, Amazon — always on" },
    { tier: "Asian", label: "Asian Market", emoji: "🏮", desc: "Asian Family Mart, H Mart" },
    { tier: "Premium", label: "Premium", emoji: "✨", desc: "Whole Foods, PCC" },
  ];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mt-4 mb-2 sm:hidden flex-shrink-0" />

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 pt-4 pb-2 flex-1">

          {/* ── Section 1: Days ── */}
          <div className="mb-6">
            <h2 className="text-base font-bold text-gray-900 mb-0.5">Dinners per week</h2>
            <p className="text-xs text-gray-400 mb-3">Enter a number from 0 to 7.</p>
            <input
              type="number"
              min={0}
              max={7}
              value={daysInput}
              onChange={(e) => setDaysInput(e.target.value)}
              onBlur={handleDaysBlur}
              className="w-20 rounded-xl border border-gray-200 px-3 py-2 text-lg font-bold
                         text-center text-gray-800 focus:outline-none focus:border-orange-400
                         focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div className="border-t border-gray-100 mb-6" />

          {/* ── Section 2: Protein counters ── */}
          <div className="mb-6">
            <h2 className="text-base font-bold text-gray-900 mb-0.5">Protein mix</h2>
            <p className="text-xs text-gray-400 mb-1">
              Distribute your {daysPerWeek} dinner{daysPerWeek !== 1 ? "s" : ""} across protein types.
            </p>
            <p className={`text-xs font-semibold mb-3 transition-colors ${
              remaining === 0 ? "text-green-600" : remaining < 0 ? "text-red-500" : "text-orange-500"
            }`}>
              {remaining === 0
                ? "✓ All slots assigned"
                : remaining > 0
                ? `${remaining} slot${remaining !== 1 ? "s" : ""} still unassigned`
                : `${Math.abs(remaining)} over limit — reduce a category`}
            </p>
            <div className="bg-gray-50 rounded-2xl px-4 py-1">
              <Counter label="Poultry" emoji="🍗" value={targets.poultry}
                onIncrement={() => adjust("poultry", 1)} onDecrement={() => adjust("poultry", -1)}
                canIncrement={sum < daysPerWeek} canDecrement={targets.poultry > 0} />
              <Counter label="Fish & Seafood" emoji="🐟" value={targets["fish-seafood"]}
                onIncrement={() => adjust("fish-seafood", 1)} onDecrement={() => adjust("fish-seafood", -1)}
                canIncrement={sum < daysPerWeek} canDecrement={targets["fish-seafood"] > 0} />
              <Counter label="Red Meat" emoji="🥩" value={targets["red-meat"]}
                onIncrement={() => adjust("red-meat", 1)} onDecrement={() => adjust("red-meat", -1)}
                canIncrement={sum < daysPerWeek} canDecrement={targets["red-meat"] > 0} />
              <Counter label="Vegetarian / Vegan" emoji="🥦" value={targets.vegetarianVegan}
                onIncrement={() => adjust("vegetarianVegan", 1)} onDecrement={() => adjust("vegetarianVegan", -1)}
                canIncrement={sum < daysPerWeek} canDecrement={targets.vegetarianVegan > 0} />
            </div>
          </div>

          <div className="border-t border-gray-100 mb-6" />

          {/* ── Section 3: Store tiers ── */}
          <div className="mb-4">
            <h2 className="text-base font-bold text-gray-900 mb-0.5">Where are you shopping?</h2>
            <p className="text-xs text-gray-400 mb-3">Only recipes you can source will be recommended.</p>
            <div className="flex flex-col gap-2">
              {storeTiers.map(({ tier, label, emoji, desc }) => {
                const checked = enabledStores.includes(tier);
                const locked = tier === "Standard";
                return (
                  <button
                    key={tier}
                    onClick={() => toggleStore(tier)}
                    disabled={locked}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition border
                      ${checked ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-gray-50 hover:border-orange-200"}
                      ${locked ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <span className="text-2xl">{emoji}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">{label}</p>
                      <p className="text-xs text-gray-400">{desc}</p>
                    </div>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition
                      ${checked ? "border-orange-500 bg-orange-500" : "border-gray-300"}`}>
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
          </div>
        </div>

        {/* Sticky submit */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3.5 rounded-2xl bg-orange-500 text-white text-sm font-bold
                       shadow-sm transition hover:bg-orange-600
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Build my plan →
          </button>
        </div>
      </div>
    </div>
  );
}