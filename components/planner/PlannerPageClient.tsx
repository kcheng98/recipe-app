"use client";

import { useState } from "react";
import { useApp } from "@/context/AppProvider";
import { CookConfirmIntercept } from "@/components/planner/CookConfirmIntercept";
import { MealPlannerView } from "@/components/planner/MealPlannerView";
import { PlannerOnboarding } from "@/components/planner/PlannerOnboarding";

export function PlannerPageClient() {
  const { plannerConfig, ready } = useApp();
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[#86868b]">
        Loading…
      </div>
    );
  }

  // No config yet — show only the onboarding modal over a placeholder background
  if (!plannerConfig) {
    return (
      <>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f5f5f7]">
          <p className="text-4xl">📅</p>
          <p className="text-lg font-semibold text-[#1d1d1f]">Set up your Meal Planner</p>
          <p className="text-sm text-[#86868b]">Just a few quick questions to get started.</p>
          <button
            onClick={() => setOnboardingOpen(true)}
            className="mt-2 rounded-xl bg-[#0071e3] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0077ed]"
          >
            Get started →
          </button>
        </div>
        <PlannerOnboarding
          open={onboardingOpen}
          onClose={() => setOnboardingOpen(false)}
        />
      </>
    );
  }

  // Config exists — show the full planner
  return (
    <>
      <CookConfirmIntercept />
      <MealPlannerView />
    </>
  );
}