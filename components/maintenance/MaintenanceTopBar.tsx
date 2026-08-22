"use client";

import Link from "next/link";
import { useMaintenance } from "@/context/MaintenanceProvider";

export default function MaintenanceTopBar() {
  const { user, syncStatus, cloudEnabled } = useMaintenance();

  return (
    <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-[#e5e5ea] bg-white px-5 sm:px-7">
      <div className="flex items-center gap-2.5">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9" />
          <path d="M10 20v-6h4v6" />
        </svg>
        <span className="text-[19px] font-bold tracking-tight text-[#1d1d1f]">Maintenance</span>
      </div>
      <div className="flex items-center gap-4">
        {cloudEnabled && (
          <Link href="/recipe/login?from=/maintenance" className="text-[13px] text-[#515154] hidden sm:inline">
            {user
              ? syncStatus === "syncing" || syncStatus === "local"
                ? "☁️ Syncing…"
                : syncStatus === "offline"
                  ? "☁️ Offline — tap to retry"
                  : syncStatus === "conflict"
                    ? "☁️ Updated elsewhere"
                    : "☁️ Account"
              : "☁️ Sign in to sync"}
          </Link>
        )}
        <Link href="/" className="flex items-center gap-1.5 text-[13px] text-[#86868b]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#86868b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6 9 12l6 6" />
          </svg>
          Back to Homebase
        </Link>
      </div>
    </div>
  );
}
