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

export type DatRate = {
  mileage: number | null;
  perTripRateUsd: number | null;
  perTripLowUsd: number | null;
  perTripHighUsd: number | null;
  perMileRateUsd: number | null;
  perMileLowUsd: number | null;
  perMileHighUsd: number | null;
  reports: number | null;
  companies: number | null;
  rateStrength: number | null;
  timeframe: string | null;
  areaType: string | null;
};

export type LookupResponse = {
  mode: "exact" | "state" | "dat" | "none";
  parsed: { origin: string; destination: string };
  historical: ShipmentRecord[] | null;
  datRate?: DatRate | null;
};

export type ImportResult = {
  parsed: number;
  inserted: number;
  alreadyInDb: number;
  companies: string[];
};

export type CustomerMonthlyLoadRow = {
  company: string;
  monthStart: string; // YYYY-MM-DD, first of that month
  loadCount: number;
};

export type CustomerMonthlyLoadsResponse = {
  startDate: string;
  rows: CustomerMonthlyLoadRow[];
};

export type InsightsCustomersResponse = {
  customers: string[];
};

export type LaneMonthlyLoadRow = {
  lane: string;
  monthStart: string; // YYYY-MM-DD, first of that month
  loadCount: number;
};

export type LaneMonthlyLoadsResponse = {
  startDate: string;
  company: string;
  rows: LaneMonthlyLoadRow[];
};

export type LaneLoadChangeRow = {
  lane: string;
  oldMonth: string; // YYYY-MM-DD
  newMonth: string; // YYYY-MM-DD
  oldCount: number;
  newCount: number;
  pctDecrease: number;
};

export type LaneLoadChangesResponse = {
  startDate: string;
  company: string;
  threshold: number;
  rows: LaneLoadChangeRow[];
};