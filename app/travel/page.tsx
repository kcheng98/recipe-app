"use client";

import { useMemo, useState } from "react";
import TravelTopBar from "@/components/travel/TravelTopBar";
import TripCard from "@/components/travel/TripCard";
import TripFormModal from "@/components/travel/TripFormModal";
import { TV, FONT_DISPLAY, FONT_BODY } from "@/components/travel/theme";
import { useTravel } from "@/context/TravelProvider";
import { currentTrip, pastTrips, yearlyStats } from "@/lib/travel/stats";
import type { Trip, TripDraft } from "@/lib/travel/types";

export default function TravelPage() {
  const { ready, trips, addTrip, updateTrip, deleteTrip } = useTravel();
  const [modalTrip, setModalTrip] = useState<Trip | "new" | null>(null);

  const nowYear = String(new Date().getFullYear());
  const stats = useMemo(() => yearlyStats(trips, nowYear), [trips, nowYear]);
  const inProgress = useMemo(() => currentTrip(trips), [trips]);
  const past = useMemo(() => pastTrips(trips), [trips]);

  function handleSave(draft: TripDraft) {
    if (modalTrip === "new" || modalTrip === null) {
      addTrip(draft);
    } else {
      updateTrip(modalTrip.id, draft);
    }
    setModalTrip(null);
  }

  function handleDelete() {
    if (modalTrip && modalTrip !== "new") deleteTrip(modalTrip.id);
    setModalTrip(null);
  }

  return (
    <div
      className="min-h-screen pb-24"
      style={{
        background: `linear-gradient(180deg, ${TV.bg}, ${TV.bg2} 420px, #f5f5f7 420px)`,
        fontFamily: FONT_BODY,
      }}
    >
      <TravelTopBar />

      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <div className="py-4 text-center">
          <div
            className="mx-auto flex h-[68px] w-[68px] items-center justify-center rounded-full text-3xl"
            style={{ border: `3px dashed ${TV.coral}`, transform: "rotate(-8deg)", color: TV.coral }}
          >
            🛂
          </div>
          <h1 className="mt-2.5 text-[26px] font-bold tracking-tight" style={{ fontFamily: FONT_DISPLAY, color: TV.ink }}>
            Passport Log
          </h1>
          <p className="mx-auto mt-1 max-w-xs text-sm" style={{ color: TV.sub }}>
            Every trip you take, in or out of the country — so you never need an I-94 lookup again.
          </p>
        </div>

        <div
          className="my-4 flex items-center justify-between gap-4 rounded-[24px] p-5"
          style={{ background: TV.surface, border: `1px solid ${TV.line}`, boxShadow: "0 8px 24px -12px rgba(20,40,80,.25)" }}
        >
          <div>
            <p className="text-[44px] font-bold leading-none" style={{ fontFamily: FONT_DISPLAY, color: TV.coral }}>
              {stats.daysAbroad}
            </p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide" style={{ color: TV.sub }}>
              Days abroad in {nowYear}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[22px] font-bold" style={{ fontFamily: FONT_DISPLAY, color: TV.teal }}>
              {stats.internationalTripCount}
            </p>
            <p className="text-xs font-bold" style={{ color: TV.sub }}>
              INTL TRIPS
            </p>
          </div>
        </div>

        <div className="mb-2 flex gap-2.5">
          <div className="flex-1 rounded-2xl p-3" style={{ background: TV.surface, border: `1px solid ${TV.line}` }}>
            <p className="text-xl font-bold" style={{ fontFamily: FONT_DISPLAY, color: TV.teal }}>
              {stats.domesticTripCount}
            </p>
            <p className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: TV.sub }}>
              Domestic trips
            </p>
          </div>
          <div className="flex-1 rounded-2xl p-3" style={{ background: TV.surface, border: `1px solid ${TV.line}` }}>
            <p className="text-xl font-bold" style={{ fontFamily: FONT_DISPLAY, color: TV.teal }}>
              {stats.domesticDays}
            </p>
            <p className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: TV.sub }}>
              Days away, domestic
            </p>
          </div>
        </div>

        {!ready ? (
          <p className="py-10 text-center text-sm" style={{ color: TV.sub }}>
            Loading…
          </p>
        ) : (
          <>
            {inProgress && (
              <>
                <SectionLabel>✈️ Currently away</SectionLabel>
                <TripCard
                  trip={inProgress}
                  onEdit={() => setModalTrip(inProgress)}
                  onDelete={() => {
                    deleteTrip(inProgress.id);
                  }}
                  onComeback={() => setModalTrip(inProgress)}
                />
              </>
            )}

            <SectionLabel>🗂 Past trips</SectionLabel>
            {past.length === 0 ? (
              <p className="rounded-2xl bg-white/60 px-4 py-8 text-center text-sm" style={{ color: TV.sub }}>
                Nothing logged yet — tap the button below to add your first trip.
              </p>
            ) : (
              past.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onEdit={() => setModalTrip(trip)}
                  onDelete={() => deleteTrip(trip.id)}
                />
              ))
            )}
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setModalTrip("new")}
        className="fixed bottom-6 right-5 rounded-full px-5 py-3.5 text-[15px] font-bold text-white shadow-lg"
        style={{ background: TV.coral, fontFamily: FONT_DISPLAY }}
      >
        + Log a trip
      </button>

      {modalTrip && (
        <TripFormModal
          trip={modalTrip === "new" ? undefined : modalTrip}
          onClose={() => setModalTrip(null)}
          onSave={handleSave}
          onDelete={modalTrip !== "new" ? handleDelete : undefined}
        />
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 mt-5 flex items-center gap-2 text-[15px] font-bold" style={{ fontFamily: FONT_DISPLAY, color: TV.ink }}>
      {children}
    </p>
  );
}
