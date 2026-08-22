"use client";

import { useState } from "react";
import { CookConfirmIntercept } from "@/components/planner/CookConfirmIntercept";
import ConflictBanner from "@/components/ConflictBanner";
import { useApp } from "@/context/AppProvider";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const { conflict, resolveConflict } = useApp();
  const [busy, setBusy] = useState(false);

  async function handle(choice: "keep-local" | "use-remote") {
    setBusy(true);
    await resolveConflict(choice);
    setBusy(false);
  }

  return (
    <>
      {conflict && (
        <ConflictBanner
          itemLabel="recipes"
          localCount={conflict.localCount}
          remoteCount={conflict.remoteCount}
          busy={busy}
          onKeepLocal={() => handle("keep-local")}
          onUseRemote={() => handle("use-remote")}
        />
      )}
      <CookConfirmIntercept />
      {children}
    </>
  );
}
