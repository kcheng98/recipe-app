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
  currentMonthKey,
  currentYearKey,
  eventsInMonth,
  eventsInYear,
  libraryCoveragePct,
  longestCookingStreak,
  monthLabel,
  monthlyCountsForYear,
  mostOverdueRerun,
  previousYearKey,
  proteinMix,
  rankMeals,
  rankMealsByFolder,
  type MonthlyCount,
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

function TopMealsRow({ meals }: { meals: RankedMeal[] }) {
  const top3 = meals.slice(0, 3);
  return (
    <div className="grid grid-cols-3 gap-3">
      {top3.map((meal) => {
        const meta = proteinMeta(meal.proteinType);
        return (
          <div key={meal.recipeId} className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-[#f5f5f7] ring-1 ring-[#e5e5ea]">
              {meal.recipe?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={meal.recipe.imageUrl} alt={meal.recipeTitle} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl">{meta.emoji}</span>
              )}
            </div>
            <p className="mt-2 truncate text-sm font-medium text-[#1d1d1f]">{meal.recipeTitle}</p>
            <p className="text-xs text-[#86868b]">{meal.count}×</p>
          </div>
        );
      })}
    </div>
  );
}

function YtdBarChart({ data, currentMonth }: { data: MonthlyCount[]; currentMonth: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const avg = data.length > 0 ? total / data.length : 0;
  const busiestEntry = data.reduce<MonthlyCount | null>(
    (best, d) => (best === null || d.count > best.count ? d : best),
    null,
  );
  const busiestLabel =
    busiestEntry && busiestEntry.count > 0 ? `${monthLabel(busiestEntry.month).split(" ")[0]} · ${busiestEntry.count}×` : "—";

  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: 96 }}>
        {data.map((d) => {
          const isCurrent = d.month === currentMonth;
          const heightPct = d.count === 0 ? 4 : Math.max(8, (d.count / max) * 100);
          return (
            <div key={d.month} className="flex flex-1 flex-col items-center justify-end gap-1">
              <div
                className="w-full rounded-t-md"
                style={{ height: `${heightPct}%`, backgroundColor: isCurrent ? "#0071e3" : "#cfe0fb" }}
              />
              <span className={`text-[10px] ${isCurrent ? "font-semibold text-[#0071e3]" : "text-[#86868b]"}`}>
                {monthLabel(d.month).slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#e5e5ea] pt-3 text-center">
        <div>
          <p className="text-xs text-[#86868b]">Total</p>
          <p className="text-sm font-semibold text-[#1d1d1f]">{total}</p>
        </div>
        <div>
          <p className="text-xs text-[#86868b]">Avg / month</p>
          <p className="text-sm font-semibold text-[#1d1d1f]">{avg.toFixed(1)}</p>
        </div>
        <div>
          <p className="text-xs text-[#86868b]">Busiest</p>
          <p className="text-sm font-semibold text-[#1d1d1f]">{busiestLabel}</p>
        </div>
      </div>
    </div>
  );
}

function FactTile({
  emoji,
  label,
  value,
  tone,
}: {
  emoji: string;
  label: string;
  value: string;
  tone: "a" | "b" | "c" | "d";
}) {
  const toneClasses: Record<string, string> = {
    a: "bg-[#eef6ff] text-[#0071e3]",
    b: "bg-[#fff2e9] text-[#c2650a]",
    c: "bg-[#eafaf1] text-[#1a8a53]",
    d: "bg-[#fdeef6] text-[#c23583]",
  };
  return (
    <div className={`rounded-xl p-3 ${toneClasses[tone]}`}>
      <p className="text-lg">{emoji}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
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
          <div
            key={slice.proteinType}
            className="grid grid-cols-[104px_1fr_34px] items-center gap-3 sm:grid-cols-[132px_1fr_40px]"
          >
            <span className="min-w-0 truncate text-sm text-[#515154]">
              {meta.emoji} {meta.label}
            </span>
            <div className="h-2 overflow-hidden rounded-full bg-[#f5f5f7]">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(slice.pct, 2)}%`, backgroundColor: meta.color }}
              />
            </div>
            <span className="text-right text-sm font-medium text-[#1d1d1f]">{slice.pct}%</span>
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
  const prevYearKey = previousYearKey(nowYearKey);

  const monthEvents = useMemo(() => eventsInMonth(cookLog, nowMonthKey), [cookLog, nowMonthKey]);
  const yearEvents = useMemo(() => eventsInYear(cookLog, nowYearKey), [cookLog, nowYearKey]);
  const prevYearEvents = useMemo(() => eventsInYear(cookLog, prevYearKey), [cookLog, prevYearKey]);

  const monthTop = useMemo(() => rankMeals(monthEvents, recipes), [monthEvents, recipes]);
  const yearTop = useMemo(() => rankMeals(yearEvents, recipes), [yearEvents, recipes]);
  const monthProtein = useMemo(() => proteinMix(monthEvents), [monthEvents]);
  const yearProtein = useMemo(() => proteinMix(yearEvents), [yearEvents]);
  const byFolder = useMemo(() => rankMealsByFolder(yearEvents, recipes), [yearEvents, recipes]);

  const busiest = useMemo(() => busiestMonth(yearEvents), [yearEvents]);
  const yearDelta = yearEvents.length - prevYearEvents.length;
  const hasPriorYearData = prevYearEvents.length > 0;

  const monthlyCounts = useMemo(
    () => monthlyCountsForYear(yearEvents, nowMonthKey),
    [yearEvents, nowMonthKey],
  );

  const allTimeTop = useMemo(() => rankMeals(cookLog, recipes), [cookLog, recipes]);
  const comfortDish = allTimeTop[0] ?? null;
  const streak = useMemo(() => longestCookingStreak(cookLog), [cookLog]);
  const coveragePct = useMemo(() => libraryCoveragePct(recipes), [recipes]);
  const overdue = useMemo(() => mostOverdueRerun(recipes), [recipes]);

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
                    <TopMealsRow meals={monthTop} />
                    <div className="mt-5">
                      <YtdBarChart data={monthlyCounts} currentMonth={nowMonthKey} />
                    </div>
                    {monthProtein.length > 0 && (
                      <div className="mt-5">
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
                    <p className="mt-0 mb-2 text-xs font-semibold uppercase tracking-wide text-[#86868b]">
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

              <SectionCard title="Highlights">
                <div className="grid grid-cols-2 gap-3">
                  {streak && streak.days > 1 && (
                    <FactTile
                      emoji="🔥"
                      label="Longest streak"
                      value={`${streak.days} day${streak.days === 1 ? "" : "s"} in a row`}
                      tone="a"
                    />
                  )}
                  {comfortDish && (
                    <FactTile
                      emoji="💛"
                      label="Comfort dish"
                      value={`${comfortDish.recipeTitle} · ${comfortDish.count}×`}
                      tone="b"
                    />
                  )}
                  <FactTile emoji="📚" label="Library cooked" value={`${coveragePct}% of recipes`} tone="c" />
                  {overdue && (
                    <FactTile
                      emoji="⏰"
                      label="Overdue for a rerun"
                      value={`${overdue.recipeTitle} · ${overdue.daysSince}d ago`}
                      tone="d"
                    />
                  )}
                </div>
              </SectionCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
