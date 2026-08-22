"use client";

/**
 * components/nutrition/ProteinMathPage.tsx
 *
 * "Protein Math" — converts a daily protein target (grams of protein per kg
 * of body weight) into grams of a specific meat/fish/etc. needed, per meal,
 * for each of two people, plus a combined daily total. Fixed to 2 meals/day
 * (lunch + dinner), 50/50 split — see lib/nutritionMath.ts.
 *
 * Each protein entry carries its own raw/cooked basis, since a real
 * household reference list is often a mix of the two (e.g. rotisserie
 * chicken is inherently a cooked-weight figure).
 */

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useApp } from "@/context/AppProvider";
import { createId } from "@/lib/storage";
import type {
  NutritionPerson,
  ProteinBasis,
  ProteinSource,
  ProteinSourceCategory,
} from "@/lib/types";
import {
  dailyProteinTarget,
  gramsNeededCombinedDaily,
  gramsNeededPerMeal,
  perMealProteinTarget,
} from "@/lib/nutritionMath";

const CATEGORY_META: Record<ProteinSourceCategory, { label: string; emoji: string }> = {
  poultry: { label: "Poultry", emoji: "🍗" },
  pork: { label: "Pork", emoji: "🥓" },
  "red-meat": { label: "Red Meat", emoji: "🥩" },
  "fish-seafood": { label: "Fish & Seafood", emoji: "🐟" },
  vegetarian: { label: "Vegetarian", emoji: "🌱" },
};

const CATEGORY_ORDER: ProteinSourceCategory[] = [
  "poultry",
  "pork",
  "red-meat",
  "fish-seafood",
  "vegetarian",
];

function formatGrams(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}g`;
}

function emptyProteinSource(category: ProteinSourceCategory): ProteinSource {
  return {
    id: createId(),
    name: "",
    category,
    proteinPer100g: 0,
    basis: "raw",
    notes: "",
  };
}

// ─── Small presentational pieces ──────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-sm text-[#515154]">{label}</span>
      <span className="text-sm font-semibold text-[#1d1d1f]">{value}</span>
    </div>
  );
}

function PersonCard({
  person,
  onChange,
}: {
  person: NutritionPerson;
  onChange: (patch: Partial<NutritionPerson>) => void;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-[#e5e5ea]">
      <input
        value={person.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Name"
        className="w-full bg-transparent text-lg font-semibold text-[#1d1d1f] focus:outline-none"
      />
      <div className="mt-3 space-y-2">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-[#515154]">Weight (kg)</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={person.weightKg || ""}
            onChange={(e) => onChange({ weightKg: Number(e.target.value) || 0 })}
            className="w-20 rounded-lg border border-[#e5e5ea] px-2 py-1 text-right text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30"
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-[#515154]">Target (g protein/kg)</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={person.gramsPerKg || ""}
            onChange={(e) => onChange({ gramsPerKg: Number(e.target.value) || 0 })}
            className="w-20 rounded-lg border border-[#e5e5ea] px-2 py-1 text-right text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30"
          />
        </label>
      </div>
      <div className="mt-3 border-t border-[#e5e5ea] pt-3">
        <StatRow label="Daily target" value={`${Math.round(dailyProteinTarget(person))}g protein`} />
        <StatRow label="Per meal (÷2)" value={`${Math.round(perMealProteinTarget(person))}g protein`} />
      </div>
    </div>
  );
}

function ProteinRow({
  source,
  people,
  onChange,
  onDelete,
}: {
  source: ProteinSource;
  people: [NutritionPerson, NutritionPerson];
  onChange: (patch: Partial<ProteinSource>) => void;
  onDelete: () => void;
}) {
  const [personA, personB] = people;
  const aGrams = gramsNeededPerMeal(personA, source);
  const bGrams = gramsNeededPerMeal(personB, source);
  const combined = gramsNeededCombinedDaily(people, source);

  return (
    <div className="rounded-xl bg-[#f5f5f7] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={source.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Protein name"
          className="min-w-[8rem] flex-1 rounded-lg border border-[#e5e5ea] bg-white px-2 py-1 text-sm font-medium text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30"
        />
        <select
          value={source.category}
          onChange={(e) => onChange({ category: e.target.value as ProteinSourceCategory })}
          className="rounded-lg border border-[#e5e5ea] bg-white px-2 py-1 text-xs text-[#1d1d1f]"
        >
          {CATEGORY_ORDER.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}
            </option>
          ))}
        </select>
        <select
          value={source.basis}
          onChange={(e) => onChange({ basis: e.target.value as ProteinBasis })}
          className="rounded-lg border border-[#e5e5ea] bg-white px-2 py-1 text-xs text-[#1d1d1f]"
        >
          <option value="raw">Raw</option>
          <option value="cooked">Cooked</option>
        </select>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete protein"
          className="ml-auto shrink-0 text-[#c7c7cc] hover:text-red-500"
        >
          ✕
        </button>
      </div>

      <label className="mt-2 flex items-center gap-2 text-xs text-[#86868b]">
        Protein per 100g:
        <input
          type="number"
          min={0}
          step={0.1}
          value={source.proteinPer100g || ""}
          onChange={(e) => onChange({ proteinPer100g: Number(e.target.value) || 0 })}
          className="w-16 rounded-lg border border-[#e5e5ea] bg-white px-2 py-0.5 text-right text-xs text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30"
        />
        g
      </label>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-white p-2 text-center ring-1 ring-[#e5e5ea]">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[#86868b]">
            {personA.name || "Person 1"}/meal
          </p>
          <p className="text-sm font-semibold text-[#1d1d1f]">{formatGrams(aGrams)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[#86868b]">
            {personB.name || "Person 2"}/meal
          </p>
          <p className="text-sm font-semibold text-[#1d1d1f]">{formatGrams(bGrams)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[#86868b]">Combined/day</p>
          <p className="text-sm font-semibold text-[#0071e3]">{formatGrams(combined)}</p>
        </div>
      </div>

      <input
        value={source.notes}
        onChange={(e) => onChange({ notes: e.target.value })}
        placeholder="Notes (optional) — e.g. bone-in yield, prep tips"
        className="mt-2 w-full bg-transparent text-xs text-[#86868b] focus:outline-none"
      />
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ProteinMathPage() {
  const { ready, folders, nutrition, setNutritionConfig } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[#86868b]">
        Loading…
      </div>
    );
  }

  const people = nutrition.people;

  const updatePerson = (index: 0 | 1, patch: Partial<NutritionPerson>) => {
    const nextPeople = [...people] as [NutritionPerson, NutritionPerson];
    nextPeople[index] = { ...nextPeople[index], ...patch };
    setNutritionConfig({ ...nutrition, people: nextPeople });
  };

  const updateProtein = (id: string, patch: Partial<ProteinSource>) => {
    setNutritionConfig({
      ...nutrition,
      proteins: nutrition.proteins.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  };

  const deleteProtein = (id: string) => {
    setNutritionConfig({
      ...nutrition,
      proteins: nutrition.proteins.filter((p) => p.id !== id),
    });
  };

  const addProtein = (category: ProteinSourceCategory) => {
    setNutritionConfig({
      ...nutrition,
      proteins: [...nutrition.proteins, emptyProteinSource(category)],
    });
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar
        folders={folders}
        activeFolder=""
        onFolderSelect={() => {}}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onManageFolders={() => {}}
        onManageLabels={() => {}}
      />

      <div className="min-h-screen flex-1 min-w-0 bg-[#f5f5f7]">
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
          <div className="mb-6 flex items-center gap-3">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#1d1d1f] shadow-sm ring-1 ring-[#e5e5ea] lg:hidden"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">🥩 Protein Math</h1>
              <p className="mt-0.5 text-sm text-[#86868b]">
                How much of each protein you need, per meal — lunch + dinner, split evenly.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PersonCard person={people[0]} onChange={(patch) => updatePerson(0, patch)} />
            <PersonCard person={people[1]} onChange={(patch) => updatePerson(1, patch)} />
          </div>

          <div className="mt-4 space-y-4">
            {CATEGORY_ORDER.map((category) => {
              const items = nutrition.proteins.filter((p) => p.category === category);
              return (
                <div key={category} className="rounded-2xl bg-white p-5 ring-1 ring-[#e5e5ea]">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-[#1d1d1f]">
                      {CATEGORY_META[category].emoji} {CATEGORY_META[category].label}
                    </h2>
                    <button
                      type="button"
                      onClick={() => addProtein(category)}
                      className="text-sm font-medium text-[#0071e3] hover:underline"
                    >
                      + Add
                    </button>
                  </div>
                  {items.length === 0 ? (
                    <p className="mt-3 text-sm text-[#86868b]">Nothing here yet.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {items.map((source) => (
                        <ProteinRow
                          key={source.id}
                          source={source}
                          people={people}
                          onChange={(patch) => updateProtein(source.id, patch)}
                          onDelete={() => deleteProtein(source.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
