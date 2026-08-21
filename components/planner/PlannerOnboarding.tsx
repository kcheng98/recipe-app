"use client";

/**
 * components/planner/PlannerOnboarding.tsx
 *
 * Single-page scrollable config sheet (replaces 3-step wizard).
 * Sections visible simultaneously: days, protein counters.
 * Submit button at the bottom generates the plan immediately.
 */

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/context/AppProvider";
import { defaultProteinTargets, normalizeProteinTargets } from "@/lib/defaults";
import type { PlannerConfig, ProteinTargets } from "@/lib/types";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function proteinSum(targets: ProteinTargets): number {
  return (
    targets.poultry +
    targets["fish-seafood"] +
    targets["red-meat"] +
    targets.pork +
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
  const { setPlannerConfig, generateMealPlan, plannerConfig } = useApp();

  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [daysInput, setDaysInput] = useState("5");
  const [targets, setTargets] = useState<ProteinTargets>(defaultProteinTargets);

  // Keep daysInput in sync when daysPerWeek changes programmatically
  useEffect(() => {
    setDaysInput(String(daysPerWeek));
  }, [daysPerWeek]);

  // Reset to current saved config whenever modal opens. normalizeProteinTargets
  // backfills any keys missing from an older saved config (e.g. `pork`, added
  // after some users already had a PlannerConfig) so the sum below never NaNs.
  useEffect(() => {
    if (open) {
      const days = plannerConfig?.daysPerWeek ?? 5;
      setDaysPerWeek(days);
      setDaysInput(String(days));
      setTargets(
        plannerConfig
          ? normalizeProteinTargets(plannerConfig.proteinTargets)
          : defaultProteinTargets,
      );
    }
  }, [open, plannerConfig]);

  const handleDaysBlur = () => {
    const n = Math.min(7, Math.max(0, parseInt(daysInput) || 0));
    setDaysPerWeek(n);
    setDaysInput(String(n));
  };

  const adjust = useCallback((key: keyof ProteinTargets, delta: number) => {
    setTargets((prev) => ({ ...prev, [key]: Math.max(0, prev[key] + delta) }));
  }, []);

  const sum = proteinSum(targets);
  const remaining = daysPerWeek - sum;
  const canSubmit = remaining === 0 && daysPerWeek > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const config: PlannerConfig = { daysPerWeek, proteinTargets: targets };
    setPlannerConfig(config);
    setTimeout(() => generateMealPlan(todayISO()), 0);
    onClose();
  };

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
              <Counter label="Pork" emoji="🥓" value={targets.pork}
                onIncrement={() => adjust("pork", 1)} onDecrement={() => adjust("pork", -1)}
                canIncrement={sum < daysPerWeek} canDecrement={targets.pork > 0} />
              <Counter label="Vegetarian / Vegan" emoji="🥦" value={targets.vegetarianVegan}
                onIncrement={() => adjust("vegetarianVegan", 1)} onDecrement={() => adjust("vegetarianVegan", -1)}
                canIncrement={sum < daysPerWeek} canDecrement={targets.vegetarianVegan > 0} />
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