"use client";

import { CookConfirmIntercept } from "@/components/planner/CookConfirmIntercept";

export function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CookConfirmIntercept />
      {children}
    </>
  );
}