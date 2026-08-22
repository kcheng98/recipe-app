"use client";

import { useState } from "react";
import ConflictBanner from "@/components/ConflictBanner";
import { useMaintenance } from "@/context/MaintenanceProvider";

export default function MaintenanceConflictBanner() {
  const { conflict, resolveConflict } = useMaintenance();
  const [busy, setBusy] = useState(false);

  if (!conflict) return null;

  async function handle(choice: "keep-local" | "use-remote") {
    setBusy(true);
    await resolveConflict(choice);
    setBusy(false);
  }

  return (
    <ConflictBanner
      itemLabel="maintenance items"
      localCount={conflict.localCount}
      remoteCount={conflict.remoteCount}
      busy={busy}
      onKeepLocal={() => handle("keep-local")}
      onUseRemote={() => handle("use-remote")}
    />
  );
}
