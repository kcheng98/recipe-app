// ─── Travel (Passport Log) types ────────────────────────────────────────────

/** How the leg was traveled — drives which icon shows on the ticket. */
export type TravelMode = "flight" | "drive" | "other";

/**
 * One country's date range within an international trip. A trip with two
 * countries (e.g. Canada then Japan) gets two of these, each with its own
 * start/end — the parent Trip's departureDate/arrivalDate is just the
 * overall "left the US" / "back in the US" bookend.
 */
export type CountryVisit = {
  id: string;
  /** Free text, e.g. "Canada", "Japan" — no fixed country list. */
  country: string;
  /** ISO date string. */
  startDate: string;
  /** null = still there (this leg hasn't ended yet). */
  endDate: string | null;
};

export type TripType = "international" | "domestic";

export type Trip = {
  id: string;
  type: TripType;
  /** ISO date — left home base. */
  departureDate: string;
  /** ISO date — back in the US. null = trip still in progress (only the departure leg logged). */
  arrivalDate: string | null;
  /** Free text, not a fixed airport code — e.g. "SeaTac Airport", "Home", "Peace Arch". */
  departureLocation: string;
  /** Free text destination of the departure leg — e.g. "Vancouver, BC". */
  arrivalLocation: string;
  mode: TravelMode;
  /** Sub-visits for a multi-country international trip. Empty for domestic trips. */
  countries: CountryVisit[];
  notes?: string;
};

export type TravelData = {
  trips: Trip[];
};

export type TripDraft = {
  type: TripType;
  departureDate: string;
  arrivalDate: string | null;
  departureLocation: string;
  arrivalLocation: string;
  mode: TravelMode;
  countries: CountryVisit[];
  notes?: string;
};
