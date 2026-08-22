"use client";

import Link from "next/link";
import type { MaintenanceItem } from "@/lib/maintenance/types";
import { computeStatus, statusLabel } from "@/lib/maintenance/status";

const STATUS_COLOR: Record<string, string> = {
  overdue: "#ff3b30",
  "due-soon": "#ff9f0a",
  "on-track": "#34c759",
  "not-logged": "#8e8e93",
  "as-needed": "#c7c7cc",
};

export default function ItemRow({ item }: { item: MaintenanceItem }) {
  const status = computeStatus(item);
  const color = STATUS_COLOR[status];

  return (
    <Link
      href={`/maintenance/${item.id}`}
      className="flex items-center gap-3 border-b border-[#f0f0f2] px-5 py-3.5 last:border-b-0 hover:bg-[#f5f5f7] sm:px-6"
    >
      <div className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium text-[#1d1d1f]">{item.name}</div>
        <div className="truncate text-xs text-[#86868b]">
          {item.lastDoneDate
            ? `Last done ${item.lastDoneDate}`
            : "Never logged"}
          {item.intervalDays !== null ? ` · every ${item.intervalDays} days` : " · as needed"}
        </div>
      </div>
      <span className="flex-shrink-0 text-xs font-semibold" style={{ color }}>
        {statusLabel(item)}
      </span>
    </Link>
  );
}
