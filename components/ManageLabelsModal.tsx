"use client";

import { useState } from "react";
import { useApp } from "@/context/AppProvider";

type ManageLabelsModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function ManageLabelsModal({
  open,
  onClose,
}: ManageLabelsModalProps) {
  const { labels, addLabel, updateLabel, deleteLabel } = useApp();
  const [newName, setNewName] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/25 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 mx-4 mb-4 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ring-1 ring-[#e5e5ea] sm:mb-0">
        <h2 className="text-xl font-semibold text-[#1d1d1f]">Manage labels</h2>
        <p className="mt-1 text-sm text-[#86868b]">
          You create every label yourself—nothing is suggested automatically.
        </p>

        <ul className="mt-6 space-y-3">
          {labels.length === 0 ? (
            <p className="text-sm text-[#86868b]">No labels yet.</p>
          ) : (
            labels.map((label) => (
              <LabelRow
                key={label.id}
                name={label.name}
                onSave={(name) => updateLabel(label.id, name)}
                onDelete={() => deleteLabel(label.id)}
              />
            ))
          )}
        </ul>

        <div className="mt-6 border-t border-[#e5e5ea] pt-6">
          <p className="mb-3 text-sm font-medium text-[#515154]">New label</p>
            <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Label name"
              className="flex-1 rounded-xl border border-[#e5e5ea] px-4 py-2 text-[15px]"
            />
            <button
              type="button"
              onClick={() => {
                if (!newName.trim()) return;
                addLabel(newName);
                setNewName("");
              }}
              className="rounded-xl bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white"
            >
              Add
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-[#f5f5f7] py-3 text-sm font-medium text-[#1d1d1f]"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function LabelRow({
  name,
  onSave,
  onDelete,
}: {
  name: string;
  onSave: (name: string) => void;
  onDelete: () => void;
}) {
  const [value, setValue] = useState(name);

  return (
    <li className="flex gap-2 rounded-xl bg-[#f5f5f7] p-3">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-[#e5e5ea] bg-white px-3 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={() => onSave(value)}
        className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium ring-1 ring-[#e5e5ea]"
      >
        Save
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
      >
        Delete
      </button>
    </li>
  );
}
