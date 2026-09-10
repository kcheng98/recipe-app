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
 *
 * Card layout follows the approved kitchen-mockups.html reference: each
 * card has a small uppercase grey eyebrow label, then a large bold period
 * heading underneath — not the other way around.
 */

import { useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useApp } from "@/context/AppProvider";
import type { ProteinType } from "@/lib/types";
import {
  currentMonthKey,
  currentYearKey,
  eventsInMonth,
  eventsInYear,
  libraryCoveragePct,
  longestCookingStreak,
  monthLabel,
  monthlyCountsForYear,
  mostOverdueRerun,
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

/** "Aug 9–12" within one month, "Aug 30–Sep 2" across a month boundary. */
function formatDateRange(startISO: string, endISO: string): string {
  const s = new Date(`${startISO}T00:00:00`);
  const e = new Date(`${endISO}T00:00:00`);
  const monthOf = (d: Date) => d.toLocaleDateString("en-US", { month: "short" });
  const start = `${monthOf(s)} ${s.getDate()}`;
  const end = monthOf(s) === monthOf(e) ? `${e.getDate()}` : `${monthOf(e)} ${e.getDate()}`;
  return `${start}–${end}`;
}

// ─── Small presentational pieces ──────────────────────────────────────────────

function SectionCard({ eyebrow, period, children }: { eyebrow: string; period?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-[#e5e5ea]">
      <p className="text-xs font-bold uppercase tracking-wide text-[#86868b]">{eyebrow}</p>
      {period && <p className="mt-0.5 text-xl font-bold tracking-tight text-[#1d1d1f]">{period}</p>}
      <div className={period ? "mt-4" : "mt-3"}>{children}</div>
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[#86868b]">{children}</p>;
}

function TopMealsRow({ meals }: { meals: RankedMeal[] }) {
  const top3 = meals.slice(0, 3);
  return (
    <div className="grid grid-cols-3 gap-3">
      {top3.map((meal, i) => {
        const meta = proteinMeta(meal.proteinType);
        return (
          <div key={meal.recipeId} className="text-center">
            <div
              className="relative mx-auto flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl"
              style={{ background: `${meta.color}22` }}
            >
              <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-[11px] font-bold text-white">
                {i + 1}
              </span>
              {meal.recipe?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={meal.recipe.imageUrl} alt={meal.recipeTitle} className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl">{meta.emoji}</span>
              )}
            </div>
            <p className="mt-2 truncate text-[13px] font-semibold leading-tight text-[#1d1d1f]">{meal.recipeTitle}</p>
            <p className="text-xs text-[#86868b]">{meal.count}×</p>
          </div>
        );
      })}
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
    <div className="space-y-3">
      {mix.map((slice) => {
        const meta = proteinMeta(slice.proteinType);
        return (
          <div
            key={slice.proteinType}
            className="grid grid-cols-[104px_1fr_34px] items-center gap-2.5 sm:grid-cols-[132px_1fr_40px] sm:gap-3"
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

function YtdBarChart({ data, currentMonth }: { data: MonthlyCount[]; currentMonth: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="flex items-end gap-1.5 pt-5" style={{ height: 120 }}>
      {data.map((d) => {
        const isCurrent = d.month === currentMonth;
        const heightPct = d.count === 0 ? 4 : Math.max(6, (d.count / max) * 100);
        return (
          <div key={d.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <div className="relative w-full" style={{ height: `${heightPct}%` }}>
              <span
                className={`absolute -top-[18px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold tabular-nums ${
                  isCurrent ? "text-[#0071e3]" : "text-[#86868b]"
                }`}
              >
                {d.count}
              </span>
              <div
                className="h-full max-w-[28px] rounded-t-md rounded-b-[3px]"
                style={{ marginInline: "auto", backgroundColor: isCurrent ? "#0071e3" : "#e5e5ea" }}
              />
            </div>
            <span className={`text-[10.5px] font-semibold ${isCurrent ? "text-[#1d1d1f]" : "text-[#86868b]"}`}>
              {monthLabel(d.month).slice(0, 3)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function YtdSummary({ data }: { data: MonthlyCount[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const avg = data.length > 0 ? total / data.length : 0;
  const busiestEntry = data.reduce<MonthlyCount | null>(
    (best, d) => (best === null || d.count > best.count ? d : best),
    null,
  );
  const busiestLabel = busiestEntry && busiestEntry.count > 0 ? monthLabel(busiestEntry.month).slice(0, 3) : "—";

  return (
    <div className="mt-3 flex justify-between border-t border-[#e5e5ea] pt-3">
      <div>
        <p className="text-[17px] font-bold tabular-nums text-[#1d1d1f]">{total}</p>
        <p className="text-xs text-[#86868b]">Total this year</p>
      </div>
      <div>
        <p className="text-[17px] font-bold tabular-nums text-[#1d1d1f]">{avg.toFixed(1)}</p>
        <p className="text-xs text-[#86868b]">Avg / month</p>
      </div>
      <div>
        <p className="text-[17px] font-bold tabular-nums text-[#1d1d1f]">{busiestLabel}</p>
        <p className="text-xs text-[#86868b]">Busiest month</p>
      </div>
    </div>
  );
}

function FactTile({ value, label, tone }: { value: string; label: string; tone: "a" | "b" | "c" | "d" }) {
  const toneClasses: Record<string, string> = {
    a: "bg-[#eaf3ff]",
    b: "bg-[#fdeee0]",
    c: "bg-[#e6f6ec]",
    d: "bg-[#f1e9fb]",
  };
  return (
    <div className={`rounded-2xl p-3.5 ${toneClasses[tone]}`}>
      <p className="text-[22px] font-extrabold tracking-tight text-[#1d1d1f]">{value}</p>
      <p className="mt-0.5 text-xs leading-snug text-[#1d1d1f] opacity-75">{label}</p>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function KitchenWrappedPage() {
  const { ready, cookLog, recipes, folders } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const nowMonthKey = currentMonthKey();
  const nowYearKey = currentYearKey();

  const monthEvents = useMemo(() => eventsInMonth(cookLog, nowMonthKey), [cookLog, nowMonthKey]);
  const yearEvents = useMemo(() => eventsInYear(cookLog, nowYearKey), [cookLog, nowYearKey]);

  const monthTop = useMemo(() => rankMeals(monthEvents, recipes), [monthEvents, recipes]);
  const yearTop = useMemo(() => rankMeals(yearEvents, recipes), [yearEvents, recipes]);
  const yearProtein = useMemo(() => proteinMix(yearEvents), [yearEvents]);
  const byFolder = useMemo(() => rankMealsByFolder(yearEvents, recipes), [yearEvents, recipes]);

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
              <SectionCard eyebrow="This month" period={monthLabel(nowMonthKey)}>
                {monthTop.length > 0 ? (
                  <TopMealsRow meals={monthTop} />
                ) : (
                  <EmptyNote>No meals logged this month yet.</EmptyNote>
                )}
              </SectionCard>

              <SectionCard
                eyebrow="Meals cooked"
                period={`${monthLabel(monthlyCounts[0]?.month ?? nowMonthKey).slice(0, 3)}–${monthLabel(nowMonthKey).slice(0, 3)} ${nowYearKey}`}
              >
                <YtdBarChart data={monthlyCounts} currentMonth={nowMonthKey} />
                <YtdSummary data={monthlyCounts} />
              </SectionCard>

              <SectionCard eyebrow="This year" period={`${nowYearKey} · Top ${Math.min(10, yearTop.length)}`}>
                <RankedList meals={yearTop} limit={10} />
              </SectionCard>

              {yearProtein.length > 0 && (
                <SectionCard eyebrow="Protein mix" period={nowYearKey}>
                  <ProteinMixBars mix={yearProtein} />
                </SectionCard>
              )}

              {byFolder.size > 0 && (
                <SectionCard eyebrow="Top meal by folder" period={nowYearKey}>
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

              <SectionCard eyebrow="Highlights" period="Fun facts, not just trivia">
                <div className="grid grid-cols-2 gap-3">
                  {streak && streak.days > 1 && (
                    <FactTile
                      value={`${streak.days} days`}
                      label={`🔥 Longest cooking streak — ${formatDateRange(streak.start, streak.end)}`}
                      tone="a"
                    />
                  )}
                  {comfortDish && (
                    <FactTile
                      value={comfortDish.recipeTitle}
                      label="🏆 Your comfort dish — cooked more than any other, all-time"
                      tone="b"
                    />
                  )}
                  <FactTile
                    value={`${coveragePct}%`}
                    label="📚 Of your library you've actually cooked at least once"
                    tone="c"
                  />
                  {overdue && (
                    <FactTile
                      value={`${overdue.daysSince} days`}
                      label={`⏳ Since ${overdue.recipeTitle} — most overdue rerun`}
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
