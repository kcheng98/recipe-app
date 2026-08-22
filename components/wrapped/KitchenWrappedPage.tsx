"use client";

/**
 * components/wrapped/KitchenWrappedPage.tsx
 *
 * "Kitchen Wrapped" — a live, always-current view into the cook log (see
 * lib/wrapped.ts for the aggregation logic, lib/types.ts CookEvent for the
 * data shape). Deliberately live rather than reveal-at-a-deadline: this
 * month's and this year's numbers are just whatever's true right now.
 *
 * The cook log only starts from whenever this feature shipped — there's no
 * way to reconstruct cook history from before that (recipes only ever kept
 * a single, overwritten lastCookedAt). So a brand-new install of this
 * feature starts at zero and fills in from here.
 */

import { useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useApp } from "@/context/AppProvider";
import type { ProteinType } from "@/lib/types";
import {
  busiestMonth,
  comebackMeal,
  cookFrequencyBuckets,
  currentMonthKey,
  currentYearKey,
  eventsInMonth,
  eventsInYear,
  monthLabel,
  newToRotation,
  previousYearKey,
  proteinMix,
  rankMeals,
  rankMealsByFolder,
  shiftMonthKey,
  type RankedMeal,
} from "@/lib/wrapped";

const PROTEIN_META: Record<string, { label: string; emoji: string; color: string }> = {
  poultry: { label: "Poultry", emoji: "🍗", color: "#2a78d6" },
  "red-meat": { label: "Red Meat", emoji: "🥩", color: "#eb6834" },
  pork: { label: "Pork", emoji: "🥓", color: "#1baf7a" },
  "fish-seafood": { label: "Fish & Seafood", emoji: "🐟", color: "#eda100" },
  vegetarian: { label: "Veg / Vegan", emoji: "🌱", color: "#e87ba4" },
  vegan: { label: "Veg / Vegan", emoji: "🌱", color: "#e87ba4" },
  none: { label: "Uncategorized", emoji: "🍽️", color: "#c7c7cc" },
};

function proteinMeta(p: ProteinType) {
  return PROTEIN_META[p] ?? PROTEIN_META.none;
}

function monthBoundsISO(key: string): { start: string; end: string } {
  const [y, m] = key.split("-").map(Number);
  const start = new Date(y, m - 1, 1).toISOString();
  const end = new Date(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1).toISOString();
  return { start, end };
}

function yearBoundsISO(key: string): { start: string; end: string } {
  const y = Number(key);
  return { start: new Date(y, 0, 1).toISOString(), end: new Date(y + 1, 0, 1).toISOString() };
}

// ─── Small presentational pieces ──────────────────────────────────────────────

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-[#e5e5ea]">
      <h2 className="text-lg font-semibold text-[#1d1d1f]">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-[#86868b]">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[#86868b]">{children}</p>;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-sm text-[#515154]">{label}</span>
      <span className="text-sm font-semibold text-[#1d1d1f]">{value}</span>
    </div>
  );
}

function TopMealHero({ meal }: { meal: RankedMeal }) {
  const meta = proteinMeta(meal.proteinType);
  return (
    <div className="flex items-center gap-4 rounded-xl bg-[#f5f5f7] p-4">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-[#e5e5ea]">
        {meal.recipe?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={meal.recipe.imageUrl} alt={meal.recipeTitle} className="h-full w-full object-cover" />
        ) : (
          <span className="text-2xl">{meta.emoji}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-[#1d1d1f]">{meal.recipeTitle}</p>
        <p className="mt-0.5 text-sm text-[#86868b]">
          Cooked {meal.count}× · {meta.emoji} {meta.label}
        </p>
      </div>
    </div>
  );
}

function RankedList({ meals, limit }: { meals: RankedMeal[]; limit: number }) {
  if (meals.length === 0) return <EmptyNote>Nothing logged yet.</EmptyNote>;
  return (
    <ol className="space-y-2">
      {meals.slice(0, limit).map((meal, i) => (
        <li key={meal.recipeId} className="flex items-center gap-3">
          <span className="w-5 shrink-0 text-right text-sm font-semibold text-[#c7c7cc]">{i + 1}</span>
          <span className="flex-1 truncate text-sm text-[#1d1d1f]">{meal.recipeTitle}</span>
          <span className="shrink-0 text-sm text-[#86868b]">{meal.count}×</span>
        </li>
      ))}
    </ol>
  );
}

function ProteinMixBars({ mix }: { mix: { proteinType: ProteinType; count: number; pct: number }[] }) {
  if (mix.length === 0) return <EmptyNote>Nothing logged yet.</EmptyNote>;
  return (
    <div className="space-y-2.5">
      {mix.map((slice) => {
        const meta = proteinMeta(slice.proteinType);
        return (
          <div key={slice.proteinType} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-sm text-[#515154]">
              {meta.emoji} {meta.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f5f5f7]">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(slice.pct, 2)}%`, backgroundColor: meta.color }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-sm font-medium text-[#1d1d1f]">{slice.pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function KitchenWrappedPage() {
  const { ready, cookLog, recipes, folders } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const nowMonthKey = currentMonthKey();
  const nowYearKey = currentYearKey();
  const prevMonthKey = shiftMonthKey(nowMonthKey, -1);
  const prevYearKey = previousYearKey(nowYearKey);

  const monthEvents = useMemo(() => eventsInMonth(cookLog, nowMonthKey), [cookLog, nowMonthKey]);
  const yearEvents = useMemo(() => eventsInYear(cookLog, nowYearKey), [cookLog, nowYearKey]);
  const prevMonthEvents = useMemo(() => eventsInMonth(cookLog, prevMonthKey), [cookLog, prevMonthKey]);
  const prevYearEvents = useMemo(() => eventsInYear(cookLog, prevYearKey), [cookLog, prevYearKey]);

  const monthTop = useMemo(() => rankMeals(monthEvents, recipes), [monthEvents, recipes]);
  const yearTop = useMemo(() => rankMeals(yearEvents, recipes), [yearEvents, recipes]);
  const monthProtein = useMemo(() => proteinMix(monthEvents), [monthEvents]);
  const yearProtein = useMemo(() => proteinMix(yearEvents), [yearEvents]);
  const byFolder = useMemo(() => rankMealsByFolder(yearEvents, recipes), [yearEvents, recipes]);

  const busiest = useMemo(() => busiestMonth(yearEvents), [yearEvents]);
  const monthDelta = monthEvents.length - prevMonthEvents.length;
  const yearDelta = yearEvents.length - prevYearEvents.length;
  const hasPriorYearData = prevYearEvents.length > 0;

  const monthBounds = useMemo(() => monthBoundsISO(nowMonthKey), [nowMonthKey]);
  const yearBounds = useMemo(() => yearBoundsISO(nowYearKey), [nowYearKey]);

  const newThisMonth = useMemo(
    () => newToRotation(cookLog, monthBounds.start, monthBounds.end, recipes),
    [cookLog, recipes, monthBounds],
  );
  const comeback = useMemo(
    () => comebackMeal(cookLog, yearBounds.start, yearBounds.end, recipes),
    [cookLog, recipes, yearBounds],
  );
  const { oneAndDone, regulars } = useMemo(
    () => cookFrequencyBuckets(cookLog, recipes),
    [cookLog, recipes],
  );

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[#86868b]">
        Loading…
      </div>
    );
  }

  const hasAnyData = cookLog.length > 0;

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
              <h1 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">🎁 Kitchen Wrapped</h1>
              <p className="mt-0.5 text-sm text-[#86868b]">Live, running stats from your cook log.</p>
            </div>
          </div>

          {!hasAnyData ? (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-16 text-center ring-1 ring-[#e5e5ea]">
              <p className="text-3xl mb-2">🍽️</p>
              <p className="text-lg font-medium text-[#1d1d1f]">Nothing logged yet</p>
              <p className="mt-2 max-w-sm text-sm text-[#86868b]">
                Confirm a cook — from a recipe's "Last cooked" date or the meal planner — and it'll start showing up here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <SectionCard title="This month" subtitle={monthLabel(nowMonthKey)}>
                {monthTop.length > 0 ? (
                  <>
                    <TopMealHero meal={monthTop[0]} />
                    <div className="mt-4">
                      <StatRow label="Meals cooked" value={String(monthEvents.length)} />
                      {prevMonthEvents.length > 0 && (
                        <StatRow
                          label={`Vs. ${monthLabel(prevMonthKey)}`}
                          value={`${monthDelta > 0 ? "+" : ""}${monthDelta}`}
                        />
                      )}
                    </div>
                    {monthProtein.length > 0 && (
                      <div className="mt-4">
                        <ProteinMixBars mix={monthProtein} />
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyNote>No meals logged this month yet.</EmptyNote>
                )}
              </SectionCard>

              <SectionCard title="This year" subtitle={nowYearKey}>
                {yearTop.length > 0 ? (
                  <>
                    <TopMealHero meal={yearTop[0]} />
                    <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-[#86868b]">
                      Top {Math.min(10, yearTop.length)}
                    </p>
                    <RankedList meals={yearTop} limit={10} />
                    <div className="mt-4">
                      <StatRow label="Meals cooked" value={String(yearEvents.length)} />
                      {hasPriorYearData && (
                        <StatRow
                          label={`Vs. ${prevYearKey}`}
                          value={`${yearDelta > 0 ? "+" : ""}${yearDelta}`}
                        />
                      )}
                      {busiest && (
                        <StatRow label="Busiest month" value={`${monthLabel(busiest.month)} · ${busiest.count}×`} />
                      )}
                    </div>
                    <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-[#86868b]">
                      Protein mix
                    </p>
                    <ProteinMixBars mix={yearProtein} />
                  </>
                ) : (
                  <EmptyNote>No meals logged this year yet.</EmptyNote>
                )}
              </SectionCard>

              {byFolder.size > 0 && (
                <SectionCard title="Top meal by folder" subtitle={nowYearKey}>
                  <div className="space-y-3">
                    {folders
                      .filter((f) => byFolder.has(f.id))
                      .map((f) => {
                        const top = byFolder.get(f.id)![0];
                        return (
                          <div key={f.id} className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5 text-sm text-[#515154]">
                              <span>{f.icon}</span>
                              {f.label}
                            </span>
                            <span className="truncate text-sm font-medium text-[#1d1d1f]">
                              {top.recipeTitle} <span className="text-[#86868b]">({top.count}×)</span>
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </SectionCard>
              )}

              {(newThisMonth.length > 0 || comeback || oneAndDone.length > 0 || regulars.length > 0) && (
                <SectionCard title="Highlights">
                  <div className="space-y-4">
                    {newThisMonth.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#86868b]">
                          New to the rotation this month
                        </p>
                        <p className="mt-1 text-sm text-[#1d1d1f]">
                          {newThisMonth.map((m) => m.recipeTitle).join(", ")}
                        </p>
                      </div>
                    )}
                    {comeback && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#86868b]">
                          Comeback meal
                        </p>
                        <p className="mt-1 text-sm text-[#1d1d1f]">
                          {comeback.recipeTitle} — back after {comeback.gapDays} days
                        </p>
                      </div>
                    )}
                    {regulars.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#86868b]">
                          Your regulars (all-time)
                        </p>
                        <p className="mt-1 text-sm text-[#1d1d1f]">
                          {regulars.slice(0, 5).map((m) => `${m.recipeTitle} (${m.count}×)`).join(", ")}
                        </p>
                      </div>
                    )}
                    {oneAndDone.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#86868b]">
                          One-and-done (all-time)
                        </p>
                        <p className="mt-1 text-sm text-[#1d1d1f]">
                          {oneAndDone.length} recipe{oneAndDone.length === 1 ? "" : "s"} tried once, never repeated
                        </p>
                      </div>
                    )}
                  </div>
                </SectionCard>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
