"use client";

import { useState } from "react";
import Modal from "./Modal";
import { todayISO } from "@/lib/maintenance/status";
import { useMaintenance } from "@/context/MaintenanceProvider";
import type { MaintenanceItem, MaintenanceItemDraft } from "@/lib/maintenance/types";

type ItemFormModalProps = {
  /** Pass the item being edited; omit (or leave undefined) to add a new item. */
  item?: MaintenanceItem;
  onClose: () => void;
};

export default function ItemFormModal({ item, onClose }: ItemFormModalProps) {
  const { items, addItem, updateItem } = useMaintenance();
  const isEditing = Boolean(item);

  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [interval, setInterval] = useState(
    item?.intervalDays != null ? String(item.intervalDays) : "",
  );
  const [lastDone, setLastDone] = useState(item?.lastDoneDate ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = Array.from(
    new Set(items.map((it) => it.category).filter((c): c is string => Boolean(c))),
  );

  const today = todayISO();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const intervalDays = interval.trim() === "" ? null : Number(interval);
    if (interval.trim() !== "" && (!Number.isFinite(intervalDays) || (intervalDays as number) <= 0)) {
      setError("Interval must be a positive number of days.");
      return;
    }
    if (lastDone && lastDone > today) {
      setError("Last done date can't be in the future.");
      return;
    }

    if (isEditing && item) {
      const draft: MaintenanceItemDraft = {
        name,
        category: category || undefined,
        intervalDays,
        notes: notes || undefined,
      };
      updateItem(item.id, draft);
    } else {
      const draft: MaintenanceItemDraft = {
        name,
        category: category || undefined,
        intervalDays,
        lastDoneDate: lastDone || null,
        notes: notes || undefined,
      };
      addItem(draft);
    }
    onClose();
  }

  return (
    <Modal title={isEditing ? "Edit item" : "Add item"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-2.5 text-[13px] text-red-600">{error}</div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-[#515154]">Name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Replace HVAC filter"
            className="rounded-xl border border-[#e5e5ea] px-3.5 py-2.5 text-[15px] text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-[#515154]">Category (optional)</span>
          <input
            list="maintenance-category-options"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. HVAC"
            className="rounded-xl border border-[#e5e5ea] px-3.5 py-2.5 text-[15px] text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
          />
          <datalist id="maintenance-category-options">
            {categoryOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-[#515154]">Repeat every (days, optional)</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            placeholder="Blank = as-needed"
            className="rounded-xl border border-[#e5e5ea] px-3.5 py-2.5 text-[15px] text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
          />
          {isEditing && (
            <span className="text-[11px] text-[#86868b]">
              Changing this applies going forward — your logged history stays as-is.
            </span>
          )}
        </label>

        {!isEditing && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[#515154]">Last done on (optional)</span>
            <input
              type="date"
              max={today}
              value={lastDone}
              onChange={(e) => setLastDone(e.target.value)}
              className="rounded-xl border border-[#e5e5ea] px-3.5 py-2.5 text-[15px] text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-[#515154]">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="rounded-xl border border-[#e5e5ea] px-3.5 py-2.5 text-[15px] text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
          />
        </label>

        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[#e5e5ea] py-3 text-[15px] font-medium text-[#1d1d1f]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 rounded-xl bg-[#0071e3] py-3 text-[15px] font-semibold text-white"
          >
            {isEditing ? "Save changes" : "Add item"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
