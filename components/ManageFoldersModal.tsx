"use client";

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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { useApp } from "@/context/AppProvider";
import type { Folder } from "@/lib/types";

type ManageFoldersModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function ManageFoldersModal({
  open,
  onClose,
}: ManageFoldersModalProps) {
  const { folders, addFolder, updateFolder, deleteFolder, reorderFolders } =
    useApp();
  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon] = useState("📁");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = folders.findIndex((f) => f.id === active.id);
    const newIndex = folders.findIndex((f) => f.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(folders, oldIndex, newIndex);
    reorderFolders(reordered.map((f) => f.id));
  }

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
        <h2 className="text-xl font-semibold text-[#1d1d1f]">Manage folders</h2>
        <p className="mt-1 text-sm text-[#86868b]">
          Drag to reorder. Create, rename, or delete folders.
        </p>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={folders.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="mt-6 space-y-3">
              {folders.map((folder) => (
                <SortableFolderRow
                  key={folder.id}
                  folder={folder}
                  onSave={(label, icon) => updateFolder(folder.id, label, icon)}
                  onDelete={() => deleteFolder(folder.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        <div className="mt-6 border-t border-[#e5e5ea] pt-6">
          <p className="mb-3 text-sm font-medium text-[#515154]">New folder</p>
          <div className="flex gap-2">
            <input
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              className="w-14 rounded-xl border border-[#e5e5ea] px-2 py-2 text-center"
              aria-label="Icon"
            />
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Folder name"
              className="flex-1 rounded-xl border border-[#e5e5ea] px-4 py-2 text-[15px]"
            />
            <button
              type="button"
              onClick={() => {
                if (!newLabel.trim()) return;
                addFolder(newLabel, newIcon);
                setNewLabel("");
                setNewIcon("📁");
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

function SortableFolderRow({
  folder,
  onSave,
  onDelete,
}: {
  folder: Folder;
  onSave: (label: string, icon: string) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(folder.label);
  const [icon, setIcon] = useState(folder.icon);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: folder.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex flex-wrap items-center gap-2 rounded-xl bg-[#f5f5f7] p-3"
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded-lg px-2 py-1 text-[#86868b] active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <input
        value={icon}
        onChange={(e) => setIcon(e.target.value)}
        className="w-12 rounded-lg border border-[#e5e5ea] bg-white px-1 py-1.5 text-center text-sm"
        aria-label="Folder icon"
      />
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-[#e5e5ea] bg-white px-3 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={() => onSave(label, icon)}
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
