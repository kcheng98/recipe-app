"use client";

/**
 * components/planner/MealPlannerView.tsx
 *
 * Changes in this version:
 *
 *   Feature 1 — Collapsible historical days
 *     • Past days start collapsed by default (slim single-line row).
 *     • A section-level "Recent (n) ▸/▾" toggle collapses/expands all history.
 *     • Each individual day row has its own chevron for fine-grained control.
 *
 *   Feature 2 — Drag-to-reorder upcoming meals
 *     • @dnd-kit/core + @dnd-kit/sortable wraps the upcoming section.
 *     • Dragging reorders recipe *assignments* across fixed date slots.
 *     • Locked slots are not draggable and cannot be dropped into.
 *     • On drag end, calls reorderSlots() from context (see AppProvider).
 */

import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useApp } from "@/context/AppProvider";
import { PlannerOnboarding } from "./PlannerOnboarding";
import { RecipePickerModal } from "./RecipePickerModal";
import Sidebar from "@/components/Sidebar";
import type { MealSlot, Recipe } from "@/lib/types";
import Link from "next/link";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDayLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

function formatShort(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getCurrentWeekStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, n: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ slot, isPast }: { slot: MealSlot; isPast: boolean }) {
  if (slot.status === "cooked")
    return (
      <span className="text-xs font-semibold text-green-600 bg-green-50 rounded-full px-2 py-0.5">
        ✓ Cooked
      </span>
    );
  if (slot.status === "skipped")
    return (
      <span className="text-xs font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
        Skipped
      </span>
    );
  if (isPast && slot.status === "pending")
    return (
      <span className="text-xs font-semibold text-orange-500 bg-orange-50 rounded-full px-2 py-0.5">
        Pending
      </span>
    );
  return null;
}

// ─── Collapsed (slim) row for historical days ─────────────────────────────────

function CollapsedDayRow({
  slot,
  recipe,
  onExpand,
}: {
  slot: MealSlot;
  recipe: Recipe | null;
  onExpand: () => void;
}) {
  const isPast = slot.date < todayISO();
  return (
    <button
      onClick={onExpand}
      className="w-full flex items-center gap-3 rounded-2xl border border-gray-100 bg-white
                 px-3 py-2.5 text-left transition hover:bg-gray-50 opacity-70 group"
    >
      <span className="text-gray-300 group-hover:text-gray-400 transition text-xs">▸</span>
      <span className="text-xs font-semibold text-gray-400 w-12 flex-shrink-0">
        {formatDayLabel(slot.date)}
      </span>
      <span className="flex-1 text-xs text-gray-500 truncate">
        {recipe ? recipe.title : <em className="text-gray-300">No recipe</em>}
      </span>
      <StatusBadge slot={slot} isPast={isPast} />
    </button>
  );
}

// ─── Full DayCard ──────────────────────────────────────────────────────────────

// ─── DayCard (used for both history and the drag overlay visual) ──────────────

function DayCard({
  slot,
  recipe,
  onLock,
  onSwap,
  onAdd,
  onSkip,
  onCollapse,
  isHistory,
  isDragging,
  showDragHint,
}: {
  slot: MealSlot;
  recipe: Recipe | null;
  onLock: () => void;
  onSwap: () => void;
  onAdd: () => void;
  onSkip: () => void;
  onCollapse?: () => void;
  isHistory?: boolean;
  isDragging?: boolean;
  showDragHint?: boolean;
}) {
  const today = todayISO();
  const isPast = slot.date < today;

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-3 transition select-none
        ${slot.isLocked ? "border-orange-300 bg-orange-50/40" : "border-gray-100 bg-white"}
        ${isPast ? "opacity-70" : ""}
        ${isDragging ? "shadow-xl border-blue-200 bg-blue-50/20 opacity-90" : ""}`}
    >
      {/* Drag hint icon — visual only, no listeners */}
      {showDragHint && !slot.isLocked ? (
        <div className="flex-shrink-0 text-gray-300 px-0.5 text-sm cursor-grab">
          ⠿
        </div>
      ) : (
        !isHistory && <div className="w-4 flex-shrink-0" />
      )}

      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
        {recipe?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl select-none">{recipe ? "🍽️" : "＋"}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-400 mb-0.5">{formatDayLabel(slot.date)}</p>
        {recipe ? (
          <Link
            href={`/recipes/${recipe.id}?from=planner`}
            className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2 hover:text-orange-500 transition-colors"
          >
            {recipe.title}
          </Link>
        ) : (
          <p className="text-sm text-gray-400 italic">No recipe assigned</p>
        )}
        <div className="mt-1">
          <StatusBadge slot={slot} isPast={isPast} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {isHistory && onCollapse && (
          <button
            onClick={onCollapse}
            title="Collapse"
            className="w-8 h-8 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center
                       hover:bg-gray-200 transition text-xs"
          >
            ▴
          </button>
        )}
        <button
          onClick={onLock}
          title={slot.isLocked ? "Unlock slot" : "Lock slot"}
          className={`w-8 h-8 rounded-xl flex items-center justify-center text-base transition
            ${slot.isLocked
              ? "bg-orange-100 text-orange-500 hover:bg-orange-200"
              : "bg-gray-100 text-gray-400 hover:bg-orange-50 hover:text-orange-400"}`}
        >
          {slot.isLocked ? "🔒" : "🔓"}
        </button>
        <button
          onClick={onSwap}
          disabled={slot.isLocked || !recipe}
          title="Swap recipe"
          className="w-8 h-8 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center
                     hover:bg-blue-50 hover:text-blue-500 transition text-sm font-bold
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ↻
        </button>
        <button
          onClick={onAdd}
          title="Assign a recipe"
          className="w-8 h-8 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center
                     hover:bg-green-50 hover:text-green-500 transition text-lg leading-none"
        >
          ＋
        </button>
        <button
          onClick={onSkip}
          title="Skip this slot"
          className="w-8 h-8 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center
                     hover:bg-red-50 hover:text-red-400 transition text-sm font-bold"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Sortable wrapper — whole card is the drag surface ────────────────────────

function SortableDayCard({
  slot,
  recipe,
  onLock,
  onSwap,
  onAdd,
  onSkip,
}: {
  slot: MealSlot;
  recipe: Recipe | null;
  onLock: () => void;
  onSwap: () => void;
  onAdd: () => void;
  onSkip: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: slot.date,
    disabled: slot.isLocked,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    position: "relative",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      // Whole card receives drag listeners
      {...attributes}
      {...listeners}
      className={`rounded-2xl touch-none ${!slot.isLocked ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <DayCard
        slot={slot}
        recipe={recipe}
        onLock={onLock}
        onSwap={onSwap}
        onAdd={onAdd}
        onSkip={onSkip}
        isDragging={isDragging}
        showDragHint={!slot.isLocked}
      />
      {/* Transparent overlay blocks child button/link clicks while dragging */}
      {isDragging && (
        <div className="absolute inset-0 rounded-2xl z-10" />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MealPlannerView() {
  const {
    mealPlan,
    plannerConfig,
    recipes,
    folders,
    generateMealPlan,
    lockSlot,
    swapSlot,
    skipSlot,
    reorderSlots,
  } = useApp();

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState<string | null>(null);

  // ── Feature 1: collapse state for history ──────────────────────────────────
  const today = todayISO();
  const slots = mealPlan?.slots ?? [];
  const cutoff = addDays(today, -14);
  const historySlots = slots.filter((s) => s.date < today && s.date >= cutoff);
  const upcomingSlots = slots.filter((s) => s.date >= today);

  // The whole Recent section starts collapsed (one click shows all rows)
  const [historySectionOpen, setHistorySectionOpen] = useState(false);
  // Individual row expansion — only relevant when section is open
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const toggleDate = useCallback((date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }, []);

  const toggleHistorySection = useCallback(() => {
    setHistorySectionOpen((prev) => !prev);
  }, []);

  // ── Feature 2: dnd-kit ────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeDate = active.id as string;
      const overDate = over.id as string;

      // Build current order of upcoming slot dates
      const currentDates = upcomingSlots.map((s) => s.date);
      const oldIndex = currentDates.indexOf(activeDate);
      const newIndex = currentDates.indexOf(overDate);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(currentDates, oldIndex, newIndex);
      reorderSlots(reordered);
    },
    [upcomingSlots, reorderSlots],
  );

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (!plannerConfig) return null;

  const weekStart = mealPlan?.weekStart ?? getCurrentWeekStart();
  const weekEnd =
    slots.length > 0
      ? slots[slots.length - 1].date
      : addDays(weekStart, plannerConfig.daysPerWeek - 1);
  const weekLabel = `${formatShort(weekStart)} – ${formatShort(weekEnd)}`;

  // ── Shared card factory ────────────────────────────────────────────────────
  const resolveRecipe = (slot: MealSlot): Recipe | null =>
    slot.recipeId ? (recipes.find((r) => r.id === slot.recipeId) ?? null) : null;

  const cardActions = (slot: MealSlot) => ({
    onLock: () => lockSlot(slot.date),
    onSwap: () => swapSlot(slot.date),
    onAdd: () => setPickerDate(slot.date),
    onSkip: () => {
      if (confirm(`Skip ${formatDayLabel(slot.date)}? This will clear the assigned recipe.`)) {
        skipSlot(slot.date);
      }
    },
  });


  return (
    <>
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
        <div className="flex-1 min-w-0">
          <div className="max-w-lg mx-auto px-4 py-6">

            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Open menu"
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-white
                             text-[#1d1d1f] shadow-sm ring-1 ring-[#e5e5ea]"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Meal Plan</h1>
                  <p className="text-xs text-gray-400 mt-0.5">Week of {weekLabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowOnboarding(true)}
                  className="text-xs font-semibold text-gray-500 hover:text-orange-500 transition
                             px-2 py-1.5 rounded-xl hover:bg-orange-50"
                >
                  Adjust
                </button>
                <button
                  onClick={() => generateMealPlan(todayISO())}
                  className="flex items-center gap-1.5 bg-orange-500 text-white text-xs font-bold
                             px-3 py-2 rounded-xl shadow-sm hover:bg-orange-600 active:scale-95 transition-all"
                >
                  <span className="text-sm">⟳</span> Regenerate
                </button>
              </div>
            </div>

            {/* ── Empty state ── */}
            {slots.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">📅</p>
                <p className="text-sm font-medium">No plan generated yet.</p>
                <button
                  onClick={() => generateMealPlan(weekStart)}
                  className="mt-4 text-sm font-semibold text-orange-500 hover:underline"
                >
                  Generate now →
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">

                {/* ── Feature 1: Historical section ── */}
                {historySlots.length > 0 && (
                  <>
                    {/* Section header — clicking collapses/expands the entire section */}
                    <button
                      onClick={toggleHistorySection}
                      className="flex items-center gap-2 px-1 mt-1 group"
                    >
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Recent ({historySlots.length})
                      </span>
                      <span className="text-gray-300 group-hover:text-gray-500 transition text-xs">
                        {historySectionOpen ? "▾" : "▸"}
                      </span>
                    </button>

                    {/* Rows — only rendered when section is open */}
                    {historySectionOpen && historySlots.map((slot) => {
                      const recipe = resolveRecipe(slot);
                      const isExpanded = expandedDates.has(slot.date);
                      return isExpanded ? (
                        <DayCard
                          key={slot.date}
                          slot={slot}
                          recipe={recipe}
                          isHistory
                          onCollapse={() => toggleDate(slot.date)}
                          {...cardActions(slot)}
                        />
                      ) : (
                        <CollapsedDayRow
                          key={slot.date}
                          slot={slot}
                          recipe={recipe}
                          onExpand={() => toggleDate(slot.date)}
                        />
                      );
                    })}

                    <div className="border-t border-gray-100 my-2" />
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
                      Upcoming
                    </p>
                  </>
                )}

                {/* ── Feature 2: Upcoming section with drag-to-reorder ── */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={upcomingSlots.map((s) => s.date)}
                    strategy={verticalListSortingStrategy}
                  >
                    {upcomingSlots.map((slot) => (
                      <SortableDayCard
                        key={slot.date}
                        slot={slot}
                        recipe={resolveRecipe(slot)}
                        {...cardActions(slot)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>

              </div>
            )}

            {/* ── Config footer ── */}
            <div className="mt-6 p-3 rounded-2xl bg-gray-50 border border-gray-100">
              <p className="text-xs text-gray-400 font-medium">
                {plannerConfig.daysPerWeek} dinners/week
              </p>
              <p className="text-xs text-gray-300 mt-1">
                💡 Drag ⠿ to reorder upcoming meals. Locked slots stay fixed.
              </p>
            </div>

          </div>
        </div>
      </div>

      <PlannerOnboarding open={showOnboarding} onClose={() => setShowOnboarding(false)} />
      <RecipePickerModal date={pickerDate} onClose={() => setPickerDate(null)} />
    </>
  );
}