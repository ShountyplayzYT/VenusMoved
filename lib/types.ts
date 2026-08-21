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