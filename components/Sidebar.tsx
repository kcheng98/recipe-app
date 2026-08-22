"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();

  const allFolders = [
    { id: ALL_FOLDER_ID, label: "All Recipes", icon: "📚" },
    ...folders,
  ];

  const isPlannerActive = pathname === "/planner";
  const isWrappedActive = pathname === "/wrapped";

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
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[#e5e5ea] bg-white transition-transform lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center px-6">
          <h1 className="text-xl font-bold tracking-tight text-[#1d1d1f]">
            Kitchen Library
          </h1>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {/* ── Folders ───────────────────────────────────────────────────── */}
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-[#86868b]">
            Folders
          </p>
          <ul className="space-y-0.5">
            {allFolders.map((folder) => {
              const isActive = !isPlannerActive && !isWrappedActive && folder.id === activeFolder;
              return (
                <li key={folder.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (isPlannerActive || isWrappedActive) {
                        window.location.href = folder.id === ALL_FOLDER_ID ? "/" : `/?folder=${folder.id}`;
                      } else {
                        onFolderSelect(folder.id);
                      }
                      onClose();
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition ${
                      isActive
                        ? "bg-[#e8f2fc] font-medium text-[#0071e3]"
                        : "text-[#1d1d1f] hover:bg-[#f5f5f7]"
                    }`}
                  >
                    <span className="text-lg">{folder.icon}</span>
                    <span className="truncate">{folder.label}</span>
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

          {/* ── Workspace ─────────────────────────────────────────────────── */}
          <p className="mt-6 mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-[#86868b]">
            Workspace
          </p>
          <ul className="space-y-0.5">
            <li>
              <Link
                href="/planner"
                onClick={onClose}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition ${
                  isPlannerActive
                    ? "bg-[#e8f2fc] font-medium text-[#0071e3]"
                    : "text-[#1d1d1f] hover:bg-[#f5f5f7]"
                }`}
              >
                <span className="text-lg">📅</span>
                <span className="truncate">Meal Planner</span>
              </Link>
            </li>
            <li>
              <Link
                href="/wrapped"
                onClick={onClose}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition ${
                  isWrappedActive
                    ? "bg-[#e8f2fc] font-medium text-[#0071e3]"
                    : "text-[#1d1d1f] hover:bg-[#f5f5f7]"
                }`}
              >
                <span className="text-lg">🎁</span>
                <span className="truncate">Kitchen Wrapped</span>
              </Link>
            </li>
            <li>
              <span className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] text-[#c7c7cc] cursor-not-allowed">
                <span className="text-lg">🛒</span>
                <span className="truncate">Shopping List</span>
                <span className="ml-auto text-xs text-[#c7c7cc]">Soon</span>
              </span>
            </li>
          </ul>
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
                ? syncStatus === "syncing" || syncStatus === "local"
                  ? "☁️ Syncing…"
                  : syncStatus === "offline"
                    ? "☁️ Offline — tap to retry"
                    : syncStatus === "conflict"
                      ? "☁️ Updated elsewhere — reloaded latest"
                      : "☁️ Account & Settings"
                : syncStatus === "local"
                  ? "☁️ Syncing…"
                  : "☁️ Sign in to sync recipes"}
            </Link>
          ) : null}
        </div>
      </aside>
    </>
  );
}