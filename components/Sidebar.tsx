"use client";

import Link from "next/link";
import { useApp } from "@/context/AppProvider";
import { ALL_FOLDER_ID } from "@/lib/defaults";
import type { Folder } from "@/lib/types";

type SidebarProps = {
  folders: Folder[];
  activeFolder: string;
  onFolderSelect: (folderId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onManageFolders: () => void;
  onManageLabels: () => void;
};

export default function Sidebar({
  folders,
  activeFolder,
  onFolderSelect,
  isOpen,
  onClose,
  onManageFolders,
  onManageLabels,
}: SidebarProps) {
  const { user, syncStatus, cloudEnabled } = useApp();
  const allFolders = [
    { id: ALL_FOLDER_ID, label: "All Recipes", icon: "📚" },
    ...folders,
  ];

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[#e5e5ea] bg-white/95 backdrop-blur-xl transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#e5e5ea] px-5 py-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#1d1d1f]">
              Our Recipes
            </h1>
            <p className="text-sm text-[#86868b]">Kenzi &amp; Husband</p>
          </div>
          <button
            type="button"
            aria-label="Close sidebar"
            className="rounded-lg p-2 text-[#86868b] hover:bg-[#f5f5f7] lg:hidden"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-[#86868b]">
            Folders
          </p>
          <ul className="space-y-0.5">
            {allFolders.map((folder) => {
              const isActive = folder.id === activeFolder;
              return (
                <li key={folder.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onFolderSelect(folder.id);
                      onClose();
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition ${
                      isActive
                        ? "bg-[#e8f2fc] font-medium text-[#0071e3]"
                        : "text-[#1d1d1f] hover:bg-[#f5f5f7]"
                    }`}
                  >
                    <span className="text-lg" aria-hidden>
                      {folder.icon}
                    </span>
                    {folder.label}
                  </button>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={onManageFolders}
            className="mt-2 w-full rounded-xl px-3 py-2 text-left text-sm text-[#0071e3] hover:bg-[#f5f5f7]"
          >
            + Manage folders
          </button>
        </nav>

        <div className="border-t border-[#e5e5ea] px-3 py-4">
          <button
            type="button"
            onClick={onManageLabels}
            className="w-full rounded-xl px-3 py-2 text-left text-sm text-[#0071e3] hover:bg-[#f5f5f7]"
          >
            Manage labels
          </button>
          <Link
            href="/recipes/new"
            className="mt-2 flex w-full items-center justify-center rounded-xl bg-[#0071e3] py-3 text-sm font-semibold text-white hover:bg-[#0077ed]"
          >
            + Add recipe
          </Link>
          {cloudEnabled ? (
            <Link
              href="/login"
              className="mt-3 block rounded-xl px-3 py-2 text-sm text-[#515154] hover:bg-[#f5f5f7]"
            >
              {user
                ? syncStatus === "syncing"
                  ? "☁️ Syncing…"
                  : syncStatus === "offline"
                    ? "☁️ Offline — tap to account"
                    : "☁️ Synced"
                : "☁️ Sign in to sync devices"}
            </Link>
          ) : null}
          <p className="mt-4 px-2 text-xs text-[#86868b]">
            Private · Meal plan &amp; grocery list coming later
          </p>
        </div>
      </aside>
    </>
  );
}
