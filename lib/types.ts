export type User = { email: string; name: string };

export type ShipmentRecord = {
  origin: string | null;
  destination: string | null;
  shipDate: string | null;
  lineHaul: number | null;
  additionalCharges?: number | null;
  carrierPay?: number | null;
  netProfit?: number | null;
  pct?: number | null;
  loadType?: string | null;
  company?: string | null;
};

export type LookupResponse = {
  mode: "exact" | "state" | "none";
  parsed: { origin: string; destination: string };
  historical: ShipmentRecord[] | null;
};

export type ImportResult = {
  parsed: number;
  inserted: number;
  alreadyInDb: number;
  companies: string[];
};

export type CustomerWeeklyLoadRow = {
  company: string;
  weekStart: string; // YYYY-MM-DD, Monday of that week
  loadCount: number;
};

export type CustomerWeeklyLoadsResponse = {
  startDate: string;
  rows: CustomerWeeklyLoadRow[];
};

export type InsightsCustomersResponse = {
  customers: string[];
};

export type LaneWeeklyLoadRow = {
  lane: string;
  weekStart: string; // YYYY-MM-DD, Monday of that week
  loadCount: number;
};

export type LaneWeeklyLoadsResponse = {
  startDate: string;
  company: string;
  rows: LaneWeeklyLoadRow[];
};