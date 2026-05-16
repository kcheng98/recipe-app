"use client";

import { useEffect } from "react";

/** Keeps the screen awake while cooking. Uses Wake Lock API with a no-sleep video fallback for iOS. */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof navigator === "undefined") return;

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    let video: HTMLVideoElement | null = null;

    // Try Wake Lock API first
    async function acquire() {
      if (!("wakeLock" in navigator)) {
        startVideoFallback();
        return;
      }
      try {
        lock = await navigator.wakeLock.request("screen");
        lock.addEventListener("release", () => {
          if (!cancelled) acquire();
        });
      } catch {
        startVideoFallback();
      }
    }

    // Fallback: play a tiny silent looping video — tricks iOS into keeping screen on
    function startVideoFallback() {
      if (video) return;
      video = document.createElement("video");
      video.setAttribute("playsinline", "");
      video.setAttribute("muted", "");
      video.loop = true;
      video.style.position = "fixed";
      video.style.opacity = "0";
      video.style.pointerEvents = "none";
      video.style.width = "1px";
      video.style.height = "1px";
      // Tiny 1x1 transparent mp4
      video.src =
        "data:video/mp4;base64,AAAAIGZ0eXBtcDQyAAAAAG1wNDJtcDQxaXNvbWF2YzEAAATKbW9vdgAAAGxtdmhkAAAAANLEP5XSxD+XAAAD6AAAACoAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAABhpb2RzAAAAABCAgIAHAE////9//w==";
      document.body.appendChild(video);
      video.play().catch(() => {});
    }

    acquire();

    function onVisible() {
      if (document.visibilityState === "visible" && !cancelled) acquire();
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      lock?.release().catch(() => {});
      if (video) {
        video.pause();
        video.remove();
        video = null;
      }
    };
  }, [enabled]);
}