"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import MaintenanceTopBar from "@/components/maintenance/MaintenanceTopBar";
import ItemRow from "@/components/maintenance/ItemRow";
import ItemFormModal from "@/components/maintenance/ItemFormModal";
import { useMaintenance } from "@/context/MaintenanceProvider";
import { summarizeCounts } from "@/lib/maintenance/status";
import type { MaintenanceItem } from "@/lib/maintenance/types";

const UNCATEGORIZED = "Uncategorized";

function groupByCategory(items: MaintenanceItem[]): Array<[string, MaintenanceItem[]]> {
  const groups = new Map<string, MaintenanceItem[]>();
  for (const item of items) {
    const key = item.category?.trim() || UNCATEGORIZED;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.order - b.order);
  }
  const entries = Array.from(groups.entries());
  entries.sort(([a], [b]) => {
    if (a === UNCATEGORIZED) return 1;
    if (b === UNCATEGORIZED) return -1;
    return a.localeCompare(b);
  });
  return entries;
}

export default function MaintenanceDashboardPage() {
  const { ready, items, reorderItems } = useMaintenance();
  const [addOpen, setAddOpen] = useState(false);

  const grouped = groupByCategory(items);
  const counts = summarizeCounts(items);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEndFor(categoryItems: MaintenanceItem[]) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = categoryItems.findIndex((it) => it.id === active.id);
      const newIndex = categoryItems.findIndex((it) => it.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(categoryItems, oldIndex, newIndex);
      reorderItems(reordered.map((it) => it.id));
    };
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f7]">
      <MaintenanceTopBar />

      <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-7">
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Overdue" count={counts.overdue} color="#ff3b30" />
          <StatTile label="Due soon" count={counts.dueSoon} color="#ff9f0a" />
          <StatTile label="On track" count={counts.onTrack} color="#34c759" />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-[#1d1d1f]">Items</span>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-lg bg-[#0071e3] px-3.5 py-2 text-[13px] font-semibold text-white"
          >
            + Add item
          </button>
        </div>

        {!ready ? (
          <div className="rounded-2xl border border-[#e5e5ea] bg-white px-6 py-10 text-center text-sm text-[#86868b]">
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-[#e5e5ea] bg-white px-6 py-10 text-center text-sm text-[#86868b]">
            Nothing yet — add your first maintenance item to get started.
          </div>
        ) : (
          grouped.map(([category, categoryItems]) => (
            <div key={category} className="overflow-hidden rounded-2xl border border-[#e5e5ea] bg-white">
              <div className="border-b border-[#e5e5ea] px-5 py-3 sm:px-6">
                <span className="text-[13px] font-semibold uppercase tracking-wide text-[#86868b]">
                  {category}
                </span>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEndFor(categoryItems)}
              >
                <SortableContext
                  items={categoryItems.map((it) => it.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {categoryItems.map((item) => (
                    <ItemRow key={item.id} item={item} draggable />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          ))
        )}
      </div>

      {addOpen && <ItemFormModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function StatTile({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-[#e5e5ea] bg-white px-4 py-4">
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[13px] font-medium text-[#86868b]">{label}</span>
      </div>
      <span className="text-[26px] font-bold text-[#1d1d1f]">{count}</span>
    </div>
  );
}
