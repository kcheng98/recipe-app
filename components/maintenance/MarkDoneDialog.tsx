"use client";

import { useState } from "react";
import Modal from "./Modal";
import { todayISO } from "@/lib/maintenance/status";

type MarkDoneDialogProps = {
  itemName: string;
  /** initialDate/initialNote let this same dialog serve "mark done" (blank) and "edit a history row" (prefilled). */
  initialDate?: string;
  initialNote?: string;
  title?: string;
  onConfirm: (date: string, note?: string) => void;
  onClose: () => void;
};

export default function MarkDoneDialog({
  itemName,
  initialDate,
  initialNote,
  title,
  onConfirm,
  onClose,
}: MarkDoneDialogProps) {
  const today = todayISO();
  const [date, setDate] = useState(initialDate ?? today);
  const [note, setNote] = useState(initialNote ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (date > today) {
      setError("Date can't be in the future.");
      return;
    }
    onConfirm(date, note || undefined);
    onClose();
  }

  return (
    <Modal title={title ?? `Mark "${itemName}" done`} onClose={onClose}>
      <form onSubmit={handleConfirm} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-2.5 text-[13px] text-red-600">{error}</div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-[#515154]">Date</span>
          <input
            type="date"
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-[#e5e5ea] px-3.5 py-2.5 text-[15px] text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-[#515154]">Note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
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
            Confirm
          </button>
        </div>
      </form>
    </Modal>
  );
}
