"use client";

/**
 * components/nutrition/ProteinMathPage.tsx
 *
 * "Protein Math" — an at-a-glance reference sheet, not an editor. Converts a
 * daily protein target (grams of protein per kg of body weight) into grams
 * of a specific meat/fish/etc. needed, per meal, for each of two people,
 * plus a combined daily total. Fixed to 2 meals/day (lunch + dinner), 50/50
 * split — see lib/nutritionMath.ts.
 *
 * The protein reference list itself (name, category, protein-per-100g,
 * raw/cooked basis) is fixed data — see lib/defaults.ts — and isn't editable
 * here. Only each person's weight and target ratio can be adjusted; those
 * still drive every displayed number even though protein-per-100g itself
 * isn't shown.
 */

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useApp } from "@/context/AppProvider";
import type { NutritionPerson, ProteinSource, ProteinSourceCategory } from "@/lib/types";
import { gramsNeededCombinedDaily, gramsNeededPerMeal, perMealProteinTarget } from "@/lib/nutritionMath";

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

// ─── Small presentational pieces ──────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-[#86868b] transition-transform duration-150"
      style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function PersonSummaryCard({
  person,
  onChange,
}: {
  person: NutritionPerson;
  onChange: (patch: Partial<NutritionPerson>) => void;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-[#e5e5ea]">
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-[#1d1d1f]">{person.name}</span>
        <span className="text-sm font-semibold text-[#0071e3]">
          {formatGrams(perMealProteinTarget(person))} / meal
        </span>
      </div>
      <div className="mt-2.5 flex gap-2">
        <label className="flex flex-1 items-center justify-between rounded-lg border border-[#e5e5ea] px-2.5 py-1.5 text-[13px] text-[#515154]">
          Weight
          <span className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              step={0.1}
              value={person.weightKg || ""}
              onChange={(e) => onChange({ weightKg: Number(e.target.value) || 0 })}
              className="w-12 bg-transparent text-right font-medium text-[#1d1d1f] focus:outline-none"
            />
            kg
          </span>
        </label>
        <label className="flex flex-1 items-center justify-between rounded-lg border border-[#e5e5ea] px-2.5 py-1.5 text-[13px] text-[#515154]">
          Target
          <span className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              step={0.1}
              value={person.gramsPerKg || ""}
              onChange={(e) => onChange({ gramsPerKg: Number(e.target.value) || 0 })}
              className="w-10 bg-transparent text-right font-medium text-[#1d1d1f] focus:outline-none"
            />
            g/kg
          </span>
        </label>
      </div>
    </div>
  );
}

function ProteinRow({
  source,
  people,
}: {
  source: ProteinSource;
  people: [NutritionPerson, NutritionPerson];
}) {
  const [personA, personB] = people; // personA = Kenzi, personB = Martin
  const combined = gramsNeededCombinedDaily(people, source);
  const bGrams = gramsNeededPerMeal(personB, source);
  const aGrams = gramsNeededPerMeal(personA, source);

  return (
    <div className="border-b border-[#f2f2f4] py-2.5 last:border-none">
      <div className="flex items-start gap-1.5">
        <span className="break-words text-sm leading-snug text-[#1d1d1f]">{source.name}</span>
        {source.basis === "cooked" && (
          <span className="mt-0.5 shrink-0 rounded bg-[#f2f2f4] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#86868b]">
            Cooked
          </span>
        )}
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-wide text-[#86868b]">Combined/day</div>
          <div className="text-sm font-bold text-[#0071e3]">{formatGrams(combined)}</div>
        </div>
        <div>
          <div className="truncate text-[9px] font-semibold uppercase tracking-wide text-[#86868b]">
            {personB.name}/meal
          </div>
          <div className="text-[13px] text-[#1d1d1f]">{formatGrams(bGrams)}</div>
        </div>
        <div>
          <div className="truncate text-[9px] font-semibold uppercase tracking-wide text-[#86868b]">
            {personA.name}/meal
          </div>
          <div className="text-[13px] text-[#1d1d1f]">{formatGrams(aGrams)}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ProteinMathPage() {
  const { ready, folders, nutrition, setNutritionConfig } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<ProteinSourceCategory, boolean>>({
    poultry: false,
    pork: false,
    "red-meat": false,
    "fish-seafood": false,
    vegetarian: false,
  });

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[#86868b]">
        Loading…
      </div>
    );
  }

  const people = nutrition.people;
  const [personA, personB] = people; // Kenzi, Martin

  const updatePerson = (index: 0 | 1, patch: Partial<NutritionPerson>) => {
    const nextPeople = [...people] as [NutritionPerson, NutritionPerson];
    nextPeople[index] = { ...nextPeople[index], ...patch };
    setNutritionConfig({ ...nutrition, people: nextPeople });
  };

  const toggleCategory = (category: ProteinSourceCategory) => {
    setOpenCategories((prev) => ({ ...prev, [category]: !prev[category] }));
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
          <div className="mb-5 flex items-center gap-3">
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PersonSummaryCard person={personA} onChange={(patch) => updatePerson(0, patch)} />
            <PersonSummaryCard person={personB} onChange={(patch) => updatePerson(1, patch)} />
          </div>

          <div className="mt-3 space-y-3">
            {CATEGORY_ORDER.map((category) => {
              const items = nutrition.proteins.filter((p) => p.category === category);
              if (items.length === 0) return null;
              const isOpen = openCategories[category];
              return (
                <div key={category} className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#e5e5ea]">
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="flex w-full items-center gap-2.5 px-5 py-3.5 text-left hover:bg-[#fafafa]"
                  >
                    <ChevronIcon open={isOpen} />
                    <span className="text-lg">{CATEGORY_META[category].emoji}</span>
                    <span className="text-base font-semibold text-[#1d1d1f]">
                      {CATEGORY_META[category].label}
                    </span>
                    <span className="ml-auto text-sm text-[#86868b]">
                      {items.length} {items.length === 1 ? "item" : "items"}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-3.5">
                      {items.map((source) => (
                        <ProteinRow key={source.id} source={source} people={people} />
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
