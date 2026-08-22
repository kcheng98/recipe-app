"use client";

import { useState } from "react";
import MaintenanceTopBar from "@/components/maintenance/MaintenanceTopBar";
import ItemRow from "@/components/maintenance/ItemRow";
import AddItemModal from "@/components/maintenance/AddItemModal";
import { useMaintenance } from "@/context/MaintenanceProvider";
import { sortByUrgency, summarizeCounts } from "@/lib/maintenance/status";

export default function MaintenanceDashboardPage() {
  const { ready, items } = useMaintenance();
  const [addOpen, setAddOpen] = useState(false);

  const sorted = sortByUrgency(items);
  const counts = summarizeCounts(items);

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f7]">
      <MaintenanceTopBar />

      <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-7">
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Overdue" count={counts.overdue} color="#ff3b30" />
          <StatTile label="Due soon" count={counts.dueSoon} color="#ff9f0a" />
          <StatTile label="On track" count={counts.onTrack} color="#34c759" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#e5e5ea] bg-white">
          <div className="flex items-center justify-between border-b border-[#e5e5ea] px-5 py-3.5 sm:px-6">
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
            <div className="px-6 py-10 text-center text-sm text-[#86868b]">Loading…</div>
          ) : sorted.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-[#86868b]">
              Nothing yet — add your first maintenance item to get started.
            </div>
          ) : (
            sorted.map((item) => <ItemRow key={item.id} item={item} />)
          )}
        </div>
      </div>

      {addOpen && <AddItemModal onClose={() => setAddOpen(false)} />}
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
