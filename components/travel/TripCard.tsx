"use client";

import type { Trip, TravelMode } from "@/lib/travel/types";
import { formatDateRange, isInProgress, tripDays } from "@/lib/travel/stats";
import { TV, FONT_DISPLAY } from "./theme";

const MODE_ICON: Record<TravelMode, string> = {
  flight: "✈️",
  drive: "🚗",
  other: "🧳",
};

export default function TripCard({
  trip,
  onEdit,
  onDelete,
  onComeback,
}: {
  trip: Trip;
  onEdit: () => void;
  onDelete: () => void;
  onComeback?: () => void;
}) {
  const inProgress = isInProgress(trip);
  const accent = trip.type === "international" ? TV.coral : TV.teal;
  const days = tripDays(trip);

  return (
    <div
      className="relative mb-4 flex overflow-visible rounded-[18px]"
      style={{
        background: TV.surface,
        border: `1px solid ${TV.line}`,
        borderLeft: `4px solid ${accent}`,
        boxShadow: "0 6px 16px -10px rgba(20,40,80,.3)",
      }}
    >
      <div className="min-w-0 flex-1 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10.5px] font-extrabold uppercase tracking-wide"
            style={{
              background: trip.type === "international" ? TV.coralSoft : TV.tealSoft,
              color: accent,
            }}
          >
            {trip.type === "international" ? "🌍 International" : "🗺️ Domestic"}
          </span>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit trip"
              className="flex h-6 w-6 items-center justify-center rounded-full text-[13px]"
              style={{ color: TV.sub }}
            >
              ✏️
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete trip"
              className="flex h-6 w-6 items-center justify-center rounded-full text-[13px]"
              style={{ color: TV.sub }}
            >
              🗑️
            </button>
          </div>
        </div>

        <div
          className="mt-2 flex flex-wrap items-center gap-1.5 text-[14px] font-bold"
          style={{ fontFamily: FONT_DISPLAY, color: TV.ink }}
        >
          <span>{trip.departureLocation}</span>
          <span className="shrink-0 text-[13px]" style={{ color: accent }}>
            {MODE_ICON[trip.mode]}
          </span>
          <span>{inProgress ? "still traveling" : trip.arrivalLocation}</span>
        </div>

        {trip.type === "international" && trip.countries.length > 0 && (
          <p className="mt-1 text-[13px]" style={{ color: TV.sub }}>
            {trip.countries.map((c) => c.country).join(" & ")}
          </p>
        )}

        <div className="mt-2 flex flex-wrap gap-2.5 text-xs" style={{ color: TV.sub }}>
          <span>🛫 {inProgress ? `Departed ${formatDateRange(trip.departureDate, null).split("–")[0]}` : formatDateRange(trip.departureDate, trip.arrivalDate).split("–")[0]}</span>
          {!inProgress && <span>🛬 {formatDateRange(trip.departureDate, trip.arrivalDate).split("–")[1]}</span>}
        </div>

        {trip.type === "international" && trip.countries.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {trip.countries.map((c) => (
              <span
                key={c.id}
                className="rounded-full px-2 py-[3px] text-[11px] font-bold"
                style={{ background: TV.tealSoft, color: TV.teal }}
              >
                {c.country}, {formatDateRange(c.startDate, c.endDate)}
              </span>
            ))}
          </div>
        )}

        {trip.notes && (
          <p className="mt-2 text-[12px] italic" style={{ color: TV.sub }}>
            {trip.notes}
          </p>
        )}
      </div>

      <div
        className="flex w-[104px] flex-shrink-0 flex-col items-center justify-center gap-0.5 border-l-2 border-dashed p-2.5 text-center"
        style={{
          borderColor: TV.line,
          background: inProgress ? TV.coralSoft : "transparent",
          borderRadius: inProgress ? "0 18px 18px 0" : undefined,
        }}
      >
        {inProgress ? (
          <>
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold" style={{ color: TV.coral }}>
              <span
                className="h-[7px] w-[7px] animate-pulse rounded-full"
                style={{ background: TV.coral }}
              />
              AWAY
            </span>
            <span className="text-2xl font-bold" style={{ fontFamily: FONT_DISPLAY, color: TV.green }}>
              {days}
            </span>
            <span className="text-[10.5px] font-bold uppercase" style={{ color: TV.sub }}>
              days so far
            </span>
            {onComeback && (
              <button
                type="button"
                onClick={onComeback}
                className="mt-1.5 rounded-full border px-2 py-[3px] text-[11px] font-bold"
                style={{ borderColor: TV.coral, color: TV.coral, background: "#fff" }}
              >
                I&apos;m back →
              </button>
            )}
          </>
        ) : (
          <>
            <span className="text-2xl font-bold" style={{ fontFamily: FONT_DISPLAY, color: TV.green }}>
              {days}
            </span>
            <span className="text-[10.5px] font-bold uppercase" style={{ color: TV.sub }}>
              days away
            </span>
          </>
        )}
      </div>
    </div>
  );
}
