"use client";

import { useState } from "react";
import ConflictBanner from "@/components/ConflictBanner";
import { useTravel } from "@/context/TravelProvider";

export default function TravelConflictBanner() {
  const { conflict, resolveConflict } = useTravel();
  const [busy, setBusy] = useState(false);

  if (!conflict) return null;

  async function handle(choice: "keep-local" | "use-remote") {
    setBusy(true);
    await resolveConflict(choice);
    setBusy(false);
  }

  return (
    <ConflictBanner
      itemLabel="trips"
      localCount={conflict.localCount}
      remoteCount={conflict.remoteCount}
      busy={busy}
      onKeepLocal={() => handle("keep-local")}
      onUseRemote={() => handle("use-remote")}
    />
  );
}
