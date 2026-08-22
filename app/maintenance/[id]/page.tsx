"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import MaintenanceTopBar from "@/components/maintenance/MaintenanceTopBar";
import MarkDoneDialog from "@/components/maintenance/MarkDoneDialog";
import ConfirmDialog from "@/components/maintenance/ConfirmDialog";
import ItemFormModal from "@/components/maintenance/ItemFormModal";
import { useMaintenance } from "@/context/MaintenanceProvider";
import { computeStatus, statusLabel } from "@/lib/maintenance/status";
import type { MaintenanceHistoryEntry } from "@/lib/maintenance/types";

const STATUS_COLOR: Record<string, string> = {
  overdue: "#ff3b30",
  "due-soon": "#ff9f0a",
  "on-track": "#34c759",
  "not-logged": "#8e8e93",
  "as-needed": "#c7c7cc",
};

const STATUS_TEXT: Record<string, string> = {
  overdue: "Overdue",
  "due-soon": "Due soon",
  "on-track": "On track",
  "not-logged": "Not yet logged",
  "as-needed": "As needed",
};

function daysBetween(fromISO: string, toISO: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(toISO).getTime() - new Date(fromISO).getTime()) / msPerDay);
}

export default function MaintenanceItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { items, deleteItem, logDone, updateHistoryEntry, deleteHistoryEntry } = useMaintenance();

  const item = items.find((it) => it.id === id);

  const [markDoneOpen, setMarkDoneOpen] = useState(false);
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MaintenanceHistoryEntry | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [deleteItemOpen, setDeleteItemOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!item) {
    return (
      <div className="flex min-h-screen flex-col bg-[#f5f5f7]">
        <MaintenanceTopBar />
        <div className="px-6 py-10 text-center text-sm text-[#86868b]">
          Item not found. It may have been deleted.
        </div>
      </div>
    );
  }

  const status = computeStatus(item);
  const color = STATUS_COLOR[status];
  const historyNewestFirst = [...item.history].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f7]">
      <MaintenanceTopBar />

      <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-7">
        <Link href="/maintenance" className="text-sm text-[#0071e3] hover:underline">
          ← Back to Maintenance
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="text-[22px] font-bold text-[#1d1d1f]">{item.name}</div>
            {item.category && <div className="text-[13px] text-[#86868b]">{item.category}</div>}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#e5e5ea]/60"
              aria-label="More options"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-11 z-10 w-44 overflow-hidden rounded-xl border border-[#e5e5ea] bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditItemOpen(true);
                  }}
                  className="w-full px-4 py-3 text-left text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
                >
                  Edit item
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setDeleteItemOpen(true);
                  }}
                  className="w-full px-4 py-3 text-left text-[14px] text-[#ff3b30] hover:bg-[#f5f5f7]"
                >
                  Delete item
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[15px] font-semibold" style={{ color }}>
              {STATUS_TEXT[status]}
            </span>
            <span className="text-[13px] text-[#86868b]">· {statusLabel(item)}</span>
          </div>
          <div className="mt-2 text-[13px] text-[#86868b]">
            {item.lastDoneDate ? `Last done ${item.lastDoneDate}` : "Never logged"}
            {item.intervalDays !== null ? ` · repeats every ${item.intervalDays} days` : " · as needed"}
          </div>
          {item.notes && <div className="mt-3 text-[14px] text-[#1d1d1f]">{item.notes}</div>}

          <button
            type="button"
            onClick={() => setMarkDoneOpen(true)}
            className="mt-4 w-full rounded-xl bg-[#0071e3] py-3 text-[15px] font-semibold text-white sm:w-auto sm:px-6"
          >
            Mark done
          </button>
        </div>

        <div className="rounded-2xl border border-[#e5e5ea] bg-white">
          <div className="border-b border-[#e5e5ea] px-5 py-3.5">
            <span className="text-[15px] font-semibold text-[#1d1d1f]">History</span>
          </div>

          {historyNewestFirst.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[#86868b]">No entries yet.</div>
          ) : (
            historyNewestFirst.map((entry, index) => {
              const priorEntry = historyNewestFirst[index + 1];
              const daysSincePrior = priorEntry ? daysBetween(priorEntry.date, entry.date) : null;
              return (
                <div
                  key={entry.id}
                  className="group flex items-center gap-3 border-b border-[#f0f0f2] px-5 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] text-[#1d1d1f]">{entry.date}</div>
                    {entry.note && <div className="truncate text-xs text-[#86868b]">{entry.note}</div>}
                    {daysSincePrior !== null && (
                      <div className="text-[11px] text-[#c7c7cc]">{daysSincePrior} days since prior</div>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setEditingEntry(entry)}
                      aria-label="Edit entry"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[#86868b] hover:bg-[#f5f5f7]"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingEntryId(entry.id)}
                      aria-label="Delete entry"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[#ff3b30] hover:bg-[#fdeceb]"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {markDoneOpen && (
        <MarkDoneDialog
          itemName={item.name}
          onConfirm={(date, note) => logDone(item.id, date, note)}
          onClose={() => setMarkDoneOpen(false)}
        />
      )}

      {editItemOpen && <ItemFormModal item={item} onClose={() => setEditItemOpen(false)} />}

      {editingEntry && (
        <MarkDoneDialog
          itemName={item.name}
          title="Edit entry"
          initialDate={editingEntry.date}
          initialNote={editingEntry.note}
          onConfirm={(date, note) => updateHistoryEntry(item.id, editingEntry.id, date, note)}
          onClose={() => setEditingEntry(null)}
        />
      )}

      {deletingEntryId && (
        <ConfirmDialog
          title="Delete this entry?"
          message="This history entry will be removed. The item's last-done date will be recalculated from what remains."
          onConfirm={() => deleteHistoryEntry(item.id, deletingEntryId)}
          onClose={() => setDeletingEntryId(null)}
        />
      )}

      {deleteItemOpen && (
        <ConfirmDialog
          title={`Delete "${item.name}"?`}
          message="This deletes the item and its full history. This can't be undone."
          onConfirm={() => {
            deleteItem(item.id);
            router.push("/maintenance");
          }}
          onClose={() => setDeleteItemOpen(false)}
        />
      )}
    </div>
  );
}
