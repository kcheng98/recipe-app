"use client";

import { useState } from "react";
import { createId } from "@/lib/storage";
import { todayISO } from "@/lib/travel/stats";
import type { CountryVisit, Trip, TravelMode, TripDraft, TripType } from "@/lib/travel/types";
import { TV, FONT_DISPLAY } from "./theme";

const MODE_OPTIONS: { value: TravelMode; label: string; icon: string }[] = [
  { value: "flight", label: "Flight", icon: "✈️" },
  { value: "drive", label: "Drive", icon: "🚗" },
  { value: "other", label: "Other", icon: "🧳" },
];

function emptyCountry(): CountryVisit {
  return { id: createId(), country: "", startDate: todayISO(), endDate: null };
}

export default function TripFormModal({
  trip,
  onClose,
  onSave,
  onDelete,
}: {
  /** Present when editing an existing trip; absent when adding a new one. */
  trip?: Trip;
  onClose: () => void;
  onSave: (draft: TripDraft) => void;
  onDelete?: () => void;
}) {
  const [type, setType] = useState<TripType>(trip?.type ?? "international");
  const [departureDate, setDepartureDate] = useState(trip?.departureDate ?? todayISO());
  const [departureLocation, setDepartureLocation] = useState(trip?.departureLocation ?? "");
  const [mode, setMode] = useState<TravelMode>(trip?.mode ?? "flight");
  const [stillTraveling, setStillTraveling] = useState(trip ? trip.arrivalDate === null : false);
  const [arrivalDate, setArrivalDate] = useState(trip?.arrivalDate ?? todayISO());
  const [arrivalLocation, setArrivalLocation] = useState(trip?.arrivalLocation ?? "");
  const [countries, setCountries] = useState<CountryVisit[]>(
    trip?.countries && trip.countries.length > 0 ? trip.countries : type === "international" ? [emptyCountry()] : [],
  );
  const [notes, setNotes] = useState(trip?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  function addCountryRow() {
    setCountries((prev) => [...prev, emptyCountry()]);
  }
  function updateCountryRow(id: string, patch: Partial<CountryVisit>) {
    setCountries((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function removeCountryRow(id: string) {
    setCountries((prev) => prev.filter((c) => c.id !== id));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!departureDate || !departureLocation.trim()) {
      setError("Departure date and location are required.");
      return;
    }
    if (!stillTraveling && !arrivalLocation.trim()) {
      setError("Arrival location is required, unless the trip is still in progress.");
      return;
    }
    if (type === "international" && countries.some((c) => !c.country.trim())) {
      setError("Give every country a name, or remove the empty row.");
      return;
    }

    onSave({
      type,
      departureDate,
      arrivalDate: stillTraveling ? null : arrivalDate,
      departureLocation,
      arrivalLocation: stillTraveling ? "still traveling" : arrivalLocation,
      mode,
      countries: type === "international" ? countries : [],
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[24px] p-5 sm:rounded-[24px]"
        style={{ background: TV.surface, fontFamily: "'Nunito', -apple-system, sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold" style={{ fontFamily: FONT_DISPLAY, color: TV.ink }}>
          {trip ? "Edit trip" : "Log a trip"} {type === "international" ? "🌍" : "🗺️"}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="flex gap-2">
            {(["international", "domestic"] as TripType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t);
                  if (t === "international" && countries.length === 0) setCountries([emptyCountry()]);
                }}
                className="flex-1 rounded-xl py-2 text-sm font-bold"
                style={{
                  background: type === t ? (t === "international" ? TV.coralSoft : TV.tealSoft) : "#f2f6fb",
                  color: type === t ? (t === "international" ? TV.coral : TV.teal) : TV.sub,
                }}
              >
                {t === "international" ? "🌍 International" : "🗺️ Domestic"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Departure date">
              <input
                type="date"
                required
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="w-full rounded-lg border px-2.5 py-1.5 text-sm"
                style={{ borderColor: TV.line }}
              />
            </Field>
            <Field label="Mode">
              <div className="flex gap-1">
                {MODE_OPTIONS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMode(m.value)}
                    aria-label={m.label}
                    className="flex-1 rounded-lg py-1.5 text-base"
                    style={{
                      background: mode === m.value ? TV.tealSoft : "#f2f6fb",
                      border: mode === m.value ? `1px solid ${TV.teal}` : "1px solid transparent",
                    }}
                  >
                    {m.icon}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="Departure location">
            <input
              type="text"
              required
              placeholder="e.g. SeaTac Airport, Home"
              value={departureLocation}
              onChange={(e) => setDepartureLocation(e.target.value)}
              className="w-full rounded-lg border px-2.5 py-1.5 text-sm"
              style={{ borderColor: TV.line }}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: TV.ink }}>
            <input
              type="checkbox"
              checked={stillTraveling}
              onChange={(e) => setStillTraveling(e.target.checked)}
            />
            Still traveling — no arrival yet
          </label>

          {!stillTraveling && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Arrival date">
                <input
                  type="date"
                  value={arrivalDate}
                  onChange={(e) => setArrivalDate(e.target.value)}
                  className="w-full rounded-lg border px-2.5 py-1.5 text-sm"
                  style={{ borderColor: TV.line }}
                />
              </Field>
              <Field label="Arrival location">
                <input
                  type="text"
                  placeholder="e.g. Vancouver, BC"
                  value={arrivalLocation}
                  onChange={(e) => setArrivalLocation(e.target.value)}
                  className="w-full rounded-lg border px-2.5 py-1.5 text-sm"
                  style={{ borderColor: TV.line }}
                />
              </Field>
            </div>
          )}

          {type === "international" && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: TV.sub }}>
                  Countries visited
                </span>
                <button
                  type="button"
                  onClick={addCountryRow}
                  className="text-xs font-bold"
                  style={{ color: TV.coral }}
                >
                  + Add country
                </button>
              </div>
              <div className="space-y-2">
                {countries.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-1.5 rounded-lg p-2" style={{ background: "#f2f6fb" }}>
                    <input
                      type="text"
                      placeholder="Country"
                      value={c.country}
                      onChange={(e) => updateCountryRow(c.id, { country: e.target.value })}
                      className="min-w-0 flex-1 rounded-md border px-2 py-1 text-sm"
                      style={{ borderColor: TV.line }}
                    />
                    <input
                      type="date"
                      value={c.startDate}
                      onChange={(e) => updateCountryRow(c.id, { startDate: e.target.value })}
                      className="rounded-md border px-2 py-1 text-xs"
                      style={{ borderColor: TV.line }}
                    />
                    <input
                      type="date"
                      value={c.endDate ?? ""}
                      onChange={(e) => updateCountryRow(c.id, { endDate: e.target.value || null })}
                      className="rounded-md border px-2 py-1 text-xs"
                      style={{ borderColor: TV.line }}
                    />
                    <button
                      type="button"
                      onClick={() => removeCountryRow(c.id)}
                      aria-label="Remove country"
                      className="text-sm"
                      style={{ color: TV.sub }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Field label="Notes (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border px-2.5 py-1.5 text-sm"
              style={{ borderColor: TV.line }}
            />
          </Field>

          {error && <p className="text-sm font-semibold" style={{ color: TV.coral }}>{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            {trip && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="mr-auto rounded-full px-3 py-2 text-sm font-bold"
                style={{ color: TV.coral }}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-bold"
              style={{ color: TV.sub }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full px-5 py-2 text-sm font-bold text-white"
              style={{ background: TV.coral }}
            >
              {trip ? "Save" : "Add trip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide" style={{ color: TV.sub }}>
        {label}
      </span>
      {children}
    </label>
  );
}
