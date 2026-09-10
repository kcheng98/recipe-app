"use client";

import Link from "next/link";
import { useTravel } from "@/context/TravelProvider";

export default function TravelTopBar() {
  const { user, syncStatus, cloudEnabled } = useTravel();

  return (
    <div
      className="flex h-16 flex-shrink-0 items-center justify-between px-5 sm:px-7"
      style={{ fontFamily: "'Nunito', -apple-system, sans-serif" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl leading-none">🛂</span>
        <span
          className="text-[20px] font-bold tracking-tight text-[#16264a]"
          style={{ fontFamily: "'Baloo 2', 'Nunito', -apple-system, sans-serif" }}
        >
          Travel
        </span>
      </div>
      <div className="flex items-center gap-4">
        {cloudEnabled && (
          <Link href="/recipe/login?from=/travel" className="hidden text-[13px] font-semibold text-[#5b6a8c] sm:inline">
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
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-[13px] font-bold text-[#16264a] shadow-sm ring-1 ring-[#c9dcef]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16264a" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6 9 12l6 6" />
          </svg>
          Back to Homebase
        </Link>
      </div>
    </div>
  );
}
