"use client";

import { useEffect } from "react";

/** Keeps the screen awake while cooking (supported in Safari 16.4+ on iOS). */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return;
    }

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        lock = await navigator.wakeLock.request("screen");
        lock.addEventListener("release", () => {
          if (!cancelled) acquire();
        });
      } catch {
        // User denied or browser does not support
      }
    }

    acquire();

    function onVisible() {
      if (document.visibilityState === "visible" && !cancelled) acquire();
    }

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [enabled]);
}
