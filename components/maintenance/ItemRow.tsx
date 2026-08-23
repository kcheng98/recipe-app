"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MaintenanceItem } from "@/lib/maintenance/types";
import { computeStatus, dueDateLabel } from "@/lib/maintenance/status";

const STATUS_COLOR: Record<string, string> = {
  overdue: "#ff3b30",
  "due-soon": "#ff9f0a",
  "on-track": "#34c759",
  "not-logged": "#8e8e93",
  "as-needed": "#c7c7cc",
};

export default function ItemRow({ item, draggable }: { item: MaintenanceItem; draggable?: boolean }) {
  const status = computeStatus(item);
  const color = STATUS_COLOR[status];

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !draggable,
  });

  const style = draggable
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.85 : 1,
      }
    : undefined;

  return (
    <div
      ref={draggable ? setNodeRef : undefined}
      style={style}
      className="flex items-start gap-2 border-b border-[#f0f0f2] px-5 py-3.5 last:border-b-0 hover:bg-[#f5f5f7] sm:px-6"
    >
      {draggable && (
        <button
          type="button"
          className="mt-0.5 flex-shrink-0 cursor-grab touch-none px-1 py-1 text-[#c7c7cc] active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      )}
      <Link href={`/maintenance/${item.id}`} className="flex min-w-0 flex-1 items-start gap-3">
        <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <div className="min-w-0 flex-1">
          <div className="break-words text-[15px] font-medium leading-snug text-[#1d1d1f]">
            {item.name}
          </div>
          <div className="mt-0.5 text-xs text-[#86868b]">
            {item.lastDoneDate ? `Last done ${item.lastDoneDate}` : "Never logged"}
            {item.intervalDays !== null ? ` · every ${item.intervalDays} days` : " · as needed"}
          </div>
          <div className="mt-1 text-xs font-semibold" style={{ color }}>
            {dueDateLabel(item)}
          </div>
        </div>
      </Link>
    </div>
  );
}
