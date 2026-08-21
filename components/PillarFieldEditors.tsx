"use client";

/**
 * components/recipe/PillarFieldEditors.tsx
 *
 * Drop-in section for the recipe edit/detail form that exposes the planner
 * pillar fields:
 *
 *   Pillar A — Protein Type     (single-select button group)
 *   Pillar B — Last Cooked At   (read-only display; stamped automatically by confirmSlot)
 *   Pillar C — Vibe             (single-select button group)
 *
 * Per the spec, these fields are NEVER shown on recipe cards in the grid —
 * they are system/planner metadata, only visible inside the edit form.
 *
 * Usage:
 *   import { PillarFieldEditors } from "@/components/recipe/PillarFieldEditors";
 *
 *   <PillarFieldEditors
 *     draft={draft}
 *     onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
 *   />
 *
 * Where `draft` is a RecipeDraft (or any object containing the pillar fields).
 */

import type { MoodVibe, ProteinType, RecipeDraft } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type PillarPatch = Pick<RecipeDraft, "proteinType" | "lastCookedAt" | "vibe">;

interface Props {
  draft: PillarPatch;
  onChange: (patch: Partial<PillarPatch>) => void;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const PROTEIN_OPTIONS: { value: ProteinType; label: string; emoji: string }[] = [
  { value: "poultry", label: "Poultry", emoji: "🍗" },
  { value: "fish-seafood", label: "Fish / Seafood", emoji: "🐟" },
  { value: "red-meat", label: "Red Meat", emoji: "🥩" },
  { value: "pork", label: "Pork", emoji: "🥓" },
  { value: "vegetarian", label: "Veg / Vegan", emoji: "🥦" },
];

const VIBE_OPTIONS: { value: MoodVibe; label: string; emoji: string; desc: string }[] = [
  {
    value: "light-fresh",
    label: "Light & Fresh",
    emoji: "🌿",
    desc: "Salads, ceviches, summer noodles",
  },
  {
    value: "all-weather",
    label: "All-Weather",
    emoji: "☁️",
    desc: "Works any season, comfort food",
  },
  {
    value: "heavy-rich",
    label: "Heavy & Rich",
    emoji: "🍲",
    desc: "Winter braises, stews",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
      {children}
    </p>
  );
}

function Pill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition whitespace-nowrap
        ${
          selected
            ? "border-orange-400 bg-orange-50 text-orange-600"
            : "border-gray-200 bg-gray-50 text-gray-500 hover:border-orange-200 hover:text-orange-500"
        }`}
    >
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PillarFieldEditors({ draft, onChange }: Props) {
  // ── Pillar A: Protein Type ─────────────────────────────────────────────────
  const renderProteinType = () => (
    <div className="mb-5">
      <SectionLabel>Protein type</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {PROTEIN_OPTIONS.map(({ value, label, emoji }) => {
          const isSelected = draft.proteinType === value;
          return (
            <Pill
              key={value}
              selected={isSelected}
              onClick={() => onChange({ proteinType: isSelected ? undefined : value })}
            >
              {emoji} {label}
            </Pill>
          );
        })}
      </div>
    </div>
  );

  // ── Pillar B: Last Cooked At (read-only) ───────────────────────────────────
  const renderLastCooked = () => {
    let displayText = "Never cooked";
    if (draft.lastCookedAt) {
      const d = new Date(draft.lastCookedAt);
      displayText = `Last cooked ${d.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })}`;
    }
    return (
      <div className="mb-5">
        <SectionLabel>Cook history</SectionLabel>
        <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
          {displayText}
          <span className="text-xs text-gray-400 block mt-0.5">
            Updated automatically when you confirm meals in the planner
          </span>
        </p>
      </div>
    );
  };

  // ── Pillar C: Vibe ─────────────────────────────────────────────────────────
  const renderVibe = () => (
    <div className="mb-5">
      <SectionLabel>Seasonal vibe</SectionLabel>
      <div className="flex flex-col gap-2">
        {VIBE_OPTIONS.map(({ value, label, emoji, desc }) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange({ vibe: value })}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border text-left transition
              ${
                draft.vibe === value
                  ? "border-orange-400 bg-orange-50"
                  : "border-gray-200 bg-gray-50 hover:border-orange-200"
              }`}
          >
            <span className="text-xl">{emoji}</span>
            <div>
              <p className="text-sm font-semibold text-gray-700">{label}</p>
              <p className="text-xs text-gray-400">{desc}</p>
            </div>
            {draft.vibe === value && (
              <span className="ml-auto text-orange-500 font-bold text-sm">✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="border-t border-gray-100 mt-6 pt-6">
      <p className="text-sm font-bold text-gray-700 mb-4">Meal Planner Settings</p>
      {renderProteinType()}
      {renderVibe()}
      {renderLastCooked()}
    </div>
  );
}
