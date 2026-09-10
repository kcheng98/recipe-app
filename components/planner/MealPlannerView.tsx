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
 *     • Dragging reorders whole day groups (a date's main + all its sides)
 *       across fixed date slots — a day's sides always travel with it.
 *     • Locked days (main locked) are not draggable and cannot be dropped into.
 *     • On drag end, calls reorderSlots() from context (see AppProvider).
 *
 *   Feature 3 — "Add a side"
 *     • Each day can hold any number of extra "side" slots alongside its
 *       one auto-managed "main" — 100% manual: added, edited, locked, and
 *       confirmed individually, never touched by regenerate/swap or the
 *       weekly protein-target math. No swap icon on a side (picked on
 *       purpose); the ＋ icon reopens the picker to change which recipe it is.
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

// ─── Day grouping ──────────────────────────────────────────────────────────────
// A date can now hold more than one slot (one main + any number of sides) —
// group them together so the UI always renders/moves/collapses a day as one unit.

type DayGroup = { date: string; main: MealSlot; sides: MealSlot[] };

function groupByDate(slots: MealSlot[]): DayGroup[] {
  const byDate = new Map<string, MealSlot[]>();
  for (const s of slots) {
    const list = byDate.get(s.date) ?? [];
    list.push(s);
    byDate.set(s.date, list);
  }
  const groups: DayGroup[] = [];
  for (const [date, list] of byDate) {
    const main = list.find((s) => s.role === "main") ?? list[0];
    const sides = list.filter((s) => s.role === "side");
    groups.push({ date, main, sides });
  }
  return groups.sort((a, b) => a.date.localeCompare(b.date));
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
  group,
  recipe,
  onExpand,
}: {
  group: DayGroup;
  recipe: Recipe | null;
  onExpand: () => void;
}) {
  const isPast = group.date < todayISO();
  return (
    <button
      onClick={onExpand}
      className="w-full flex items-center gap-3 rounded-2xl border border-gray-100 bg-white
                 px-3 py-2.5 text-left transition hover:bg-gray-50 opacity-70 group"
    >
      <span className="text-gray-300 group-hover:text-gray-400 transition text-xs">▸</span>
      <span className="text-xs font-semibold text-gray-400 w-12 flex-shrink-0">
        {formatDayLabel(group.date)}
      </span>
      <span className="flex-1 text-xs text-gray-500 truncate">
        {recipe ? recipe.title : <em className="text-gray-300">No recipe</em>}
      </span>
      {group.sides.length > 0 && (
        <span className="text-[10.5px] font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 flex-shrink-0">
          +{group.sides.length} side{group.sides.length === 1 ? "" : "s"}
        </span>
      )}
      <StatusBadge slot={group.main} isPast={isPast} />
    </button>
  );
}

// ─── Full DayCard (main slot) ──────────────────────────────────────────────────

function DayCard({
  slot,
  recipe,
  onLock,
  onSwap,
  onAdd,
  onConfirmCooked,
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
  onConfirmCooked: () => void;
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
            href={`/recipe/recipes/${recipe.id}?from=planner`}
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
          onClick={onConfirmCooked}
          disabled={!recipe}
          title="Mark cooked"
          className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold transition
            ${slot.status === "cooked"
              ? "bg-green-100 text-green-600"
              : "bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-500"}
            disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          ✓
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

// ─── Side row ──────────────────────────────────────────────────────────────────

function SideRow({
  slot,
  recipe,
  onLock,
  onEdit,
  onConfirmCooked,
  onRemove,
}: {
  slot: MealSlot;
  recipe: Recipe | null;
  onLock: () => void;
  onEdit: () => void;
  onConfirmCooked: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      {/* Thumbnail */}
      <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
        {recipe?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-base select-none">{recipe ? "🍽️" : "＋"}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[9.5px] font-extrabold uppercase tracking-wide text-gray-300 leading-none mb-0.5">
          Side
        </p>
        {recipe ? (
          <Link
            href={`/recipe/recipes/${recipe.id}?from=planner`}
            className="text-[13px] font-semibold text-gray-800 leading-tight line-clamp-1 hover:text-orange-500 transition-colors"
          >
            {recipe.title}
          </Link>
        ) : (
          <p className="text-[13px] text-gray-400 italic">No recipe assigned</p>
        )}
        <div className="mt-0.5">
          <StatusBadge slot={slot} isPast={slot.date < todayISO()} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onLock}
          title={slot.isLocked ? "Unlock side" : "Lock side"}
          className={`rounded-lg flex items-center justify-center text-xs transition
            ${slot.isLocked
              ? "bg-orange-100 text-orange-500 hover:bg-orange-200"
              : "bg-gray-100 text-gray-400 hover:bg-orange-50 hover:text-orange-400"}`}
          style={{ width: "26px", height: "26px" }}
        >
          {slot.isLocked ? "🔒" : "🔓"}
        </button>
        <button
          onClick={onEdit}
          title="Edit / change recipe"
          style={{ width: "26px", height: "26px" }}
          className="rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center
                     hover:bg-green-50 hover:text-green-500 transition text-sm leading-none"
        >
          ＋
        </button>
        <button
          onClick={onConfirmCooked}
          disabled={!recipe}
          title="Mark cooked"
          style={{ width: "26px", height: "26px" }}
          className={`rounded-lg flex items-center justify-center text-xs font-bold transition
            ${slot.status === "cooked"
              ? "bg-green-100 text-green-600"
              : "bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-500"}
            disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          ✓
        </button>
        <button
          onClick={onRemove}
          title="Remove side"
          style={{ width: "26px", height: "26px" }}
          className="rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center
                     hover:bg-red-50 hover:text-red-400 transition text-xs"
        >
          🗑
        </button>
      </div>
    </div>
  );
}

// ─── Day group wrapper — main card + its sides + "Add a side" ─────────────────

function DayGroupBody({
  group,
  resolveRecipe,
  mainActions,
  sideActionsFor,
  onAddSide,
  isHistory,
  onCollapse,
  isDragging,
  showDragHint,
}: {
  group: DayGroup;
  resolveRecipe: (slot: MealSlot) => Recipe | null;
  mainActions: {
    onLock: () => void;
    onSwap: () => void;
    onAdd: () => void;
    onConfirmCooked: () => void;
    onSkip: () => void;
  };
  sideActionsFor: (slot: MealSlot) => {
    onLock: () => void;
    onEdit: () => void;
    onConfirmCooked: () => void;
    onRemove: () => void;
  };
  onAddSide: () => void;
  isHistory?: boolean;
  onCollapse?: () => void;
  isDragging?: boolean;
  showDragHint?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <DayCard
        slot={group.main}
        recipe={resolveRecipe(group.main)}
        isHistory={isHistory}
        onCollapse={onCollapse}
        isDragging={isDragging}
        showDragHint={showDragHint}
        {...mainActions}
      />
      {group.sides.length > 0 && (
        <div className="ml-5 pl-3.5 border-l-2 border-dashed border-gray-100">
          {group.sides.map((side) => (
            <SideRow
              key={side.id}
              slot={side}
              recipe={resolveRecipe(side)}
              {...sideActionsFor(side)}
            />
          ))}
        </div>
      )}
      <button
        onClick={onAddSide}
        className="ml-5 mt-0.5 self-start inline-flex items-center gap-1.5 rounded-full border border-dashed
                   border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-400
                   hover:text-orange-500 hover:border-orange-200 hover:bg-orange-50 transition"
      >
        ＋ {group.sides.length > 0 ? "Add another side" : "Add a side"}
      </button>
    </div>
  );
}

// ─── Sortable wrapper — whole day group is the drag surface ───────────────────

function SortableDayGroup({
  group,
  resolveRecipe,
  mainActions,
  sideActionsFor,
  onAddSide,
}: {
  group: DayGroup;
  resolveRecipe: (slot: MealSlot) => Recipe | null;
  mainActions: {
    onLock: () => void;
    onSwap: () => void;
    onAdd: () => void;
    onConfirmCooked: () => void;
    onSkip: () => void;
  };
  sideActionsFor: (slot: MealSlot) => {
    onLock: () => void;
    onEdit: () => void;
    onConfirmCooked: () => void;
    onRemove: () => void;
  };
  onAddSide: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: group.date,
    disabled: group.main.isLocked,
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
      // Whole group receives drag listeners
      {...attributes}
      {...listeners}
      className={`rounded-2xl touch-none ${!group.main.isLocked ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <DayGroupBody
        group={group}
        resolveRecipe={resolveRecipe}
        mainActions={mainActions}
        sideActionsFor={sideActionsFor}
        onAddSide={onAddSide}
        isDragging={isDragging}
        showDragHint={!group.main.isLocked}
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
    confirmSlot,
    skipSlot,
    reorderSlots,
    addSide,
    removeSide,
  } = useApp();

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ id: string; date: string } | null>(null);

  // ── Feature 1: collapse state for history ──────────────────────────────────
  const today = todayISO();
  const slots = mealPlan?.slots ?? [];
  const cutoff = addDays(today, -14);
  const historySlots = slots.filter((s) => s.date < today && s.date >= cutoff);
  const upcomingSlots = slots.filter((s) => s.date >= today);

  const historyGroups = groupByDate(historySlots);
  const upcomingGroups = groupByDate(upcomingSlots);

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

      // Build current order of upcoming day groups (by date)
      const currentDates = upcomingGroups.map((g) => g.date);
      const oldIndex = currentDates.indexOf(activeDate);
      const newIndex = currentDates.indexOf(overDate);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(currentDates, oldIndex, newIndex);
      reorderSlots(reordered);
    },
    [upcomingGroups, reorderSlots],
  );

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (!plannerConfig) return null;

  const weekStart = mealPlan?.weekStart ?? getCurrentWeekStart();
  const weekEnd =
    slots.length > 0
      ? slots[slots.length - 1].date
      : addDays(weekStart, plannerConfig.daysPerWeek - 1);
  const weekLabel = `${formatShort(weekStart)} – ${formatShort(weekEnd)}`;

  // ── Shared card factories ──────────────────────────────────────────────────
  const resolveRecipe = (slot: MealSlot): Recipe | null =>
    slot.recipeId ? (recipes.find((r) => r.id === slot.recipeId) ?? null) : null;

  const mainActionsFor = (slot: MealSlot) => ({
    onLock: () => lockSlot(slot.id),
    onSwap: () => swapSlot(slot.id),
    onAdd: () => setPickerTarget({ id: slot.id, date: slot.date }),
    onConfirmCooked: () => confirmSlot(slot.id, true),
    onSkip: () => {
      if (confirm(`Skip ${formatDayLabel(slot.date)}? This will clear the assigned recipe.`)) {
        skipSlot(slot.id);
      }
    },
  });

  const sideActionsFor = (slot: MealSlot) => ({
    onLock: () => lockSlot(slot.id),
    onEdit: () => setPickerTarget({ id: slot.id, date: slot.date }),
    onConfirmCooked: () => confirmSlot(slot.id, true),
    onRemove: () => removeSide(slot.id),
  });

  const handleAddSide = (date: string) => {
    const side = addSide(date);
    setPickerTarget({ id: side.id, date });
  };

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
                {historyGroups.length > 0 && (
                  <>
                    {/* Section header — clicking collapses/expands the entire section */}
                    <button
                      onClick={toggleHistorySection}
                      className="flex items-center gap-2 px-1 mt-1 group"
                    >
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Recent ({historyGroups.length})
                      </span>
                      <span className="text-gray-300 group-hover:text-gray-500 transition text-xs">
                        {historySectionOpen ? "▾" : "▸"}
                      </span>
                    </button>

                    {/* Rows — only rendered when section is open */}
                    {historySectionOpen && historyGroups.map((group) => {
                      const isExpanded = expandedDates.has(group.date);
                      return isExpanded ? (
                        <DayGroupBody
                          key={group.date}
                          group={group}
                          resolveRecipe={resolveRecipe}
                          mainActions={mainActionsFor(group.main)}
                          sideActionsFor={sideActionsFor}
                          onAddSide={() => handleAddSide(group.date)}
                          isHistory
                          onCollapse={() => toggleDate(group.date)}
                        />
                      ) : (
                        <CollapsedDayRow
                          key={group.date}
                          group={group}
                          recipe={resolveRecipe(group.main)}
                          onExpand={() => toggleDate(group.date)}
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
                    items={upcomingGroups.map((g) => g.date)}
                    strategy={verticalListSortingStrategy}
                  >
                    {upcomingGroups.map((group) => (
                      <SortableDayGroup
                        key={group.date}
                        group={group}
                        resolveRecipe={resolveRecipe}
                        mainActions={mainActionsFor(group.main)}
                        sideActionsFor={sideActionsFor}
                        onAddSide={() => handleAddSide(group.date)}
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
                💡 Drag ⠿ to reorder upcoming days. Locked days stay fixed.
              </p>
            </div>

          </div>
        </div>
      </div>

      <PlannerOnboarding open={showOnboarding} onClose={() => setShowOnboarding(false)} />
      <RecipePickerModal target={pickerTarget} onClose={() => setPickerTarget(null)} />
    </>
  );
}
