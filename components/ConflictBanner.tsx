"use client";

/**
 * Shared across every module in Homebase (Kitchen today, Maintenance, and
 * anything added later) — whenever a device's real local data and the
 * cloud's copy have diverged enough to look like accidental data loss
 * (see lib/syncGuard.ts), this banner is the ONLY way that gets resolved:
 * an explicit human choice, never a silent auto-pick.
 */
type ConflictBannerProps = {
  /** e.g. "recipes" or "maintenance items" — plugs into the sentence. */
  itemLabel: string;
  localCount: number;
  remoteCount: number;
  busy: boolean;
  onKeepLocal: () => void;
  onUseRemote: () => void;
};

export default function ConflictBanner({
  itemLabel,
  localCount,
  remoteCount,
  busy,
  onKeepLocal,
  onUseRemote,
}: ConflictBannerProps) {
  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 border-b border-[#f0c651] bg-[#fff8e6] px-4 py-3 text-center shadow-sm sm:flex-row sm:justify-center sm:gap-4">
      <p className="text-[13px] leading-snug text-[#7a5b00]">
        <strong>This device</strong> has {localCount} {itemLabel}, but the cloud copy
        currently has {remoteCount}. Nothing has changed yet — pick which one to keep.
      </p>
      <div className="flex flex-shrink-0 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onKeepLocal}
          className="rounded-lg bg-[#0071e3] px-3.5 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : `Keep this device's ${localCount}`}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onUseRemote}
          className="rounded-lg border border-[#e5c98a] bg-white px-3.5 py-1.5 text-[13px] font-medium text-[#1d1d1f] disabled:opacity-50"
        >
          Use cloud&apos;s {remoteCount}
        </button>
      </div>
    </div>
  );
}
