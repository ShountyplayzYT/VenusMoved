"use client";

import type { LookupResponse } from "@/lib/types";

function money(v: number | null | undefined) {
  return v === null || v === undefined
    ? "—"
    : `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function DatRateCard({ datRate, compact }: { datRate: NonNullable<LookupResponse["datRate"]>; compact?: boolean }) {
  return (
    <div className={compact ? "rounded-2xl border border-border bg-panel p-5" : "rounded-2xl border border-border bg-panel p-5 mb-4"}>
      <div className="mb-4">
        <div className="font-mono-brand text-3xl font-bold text-teal">
          {money(datRate.perTripRateUsd)}
        </div>
        <div className="text-textTertiary text-[0.64rem] uppercase tracking-wide">
          DAT Rateview Estimate (per trip)
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <div>
          <span className="text-textSecondary">Range: </span>
          {money(datRate.perTripLowUsd)} – {money(datRate.perTripHighUsd)}
        </div>
        <div>
          <span className="text-textSecondary">Mileage: </span>
          {datRate.mileage ?? "—"}
        </div>
        {datRate.perMileRateUsd != null && (
          <div>
            <span className="text-textSecondary">Per mile: </span>
            {money(datRate.perMileRateUsd)}
          </div>
        )}
        <div>
          <span className="text-textSecondary">Reports: </span>
          {datRate.reports ?? "—"}
        </div>
        <div>
          <span className="text-textSecondary">Companies: </span>
          {datRate.companies ?? "—"}
        </div>
        <div>
          <span className="text-textSecondary">Rate strength: </span>
          {datRate.rateStrength ?? "—"}
        </div>
      </div>
    </div>
  );
}

export default function ResultsPanel({ result }: { result: LookupResponse }) {
  const { historical, datRate } = result;

  const validRates = (historical || [])
    .map((d) => d.lineHaul)
    .filter((v): v is number => v !== null && v !== undefined);
  const medianRate = median(validRates);

  if (!historical || historical.length === 0) {
    if (datRate) {
      // No shipment history at all, but we do have a DAT market estimate.
      return <DatRateCard datRate={datRate} />;
    }

    return (
      <div className="rounded-2xl border border-border bg-panel p-5">
        <p className="text-textSecondary text-sm">No matching shipments found for this lane.</p>
      </div>
    );
  }

  return (
    <>
      {/* Always show the DAT market estimate alongside our own history,
          even when we found an exact or state-level match. */}
      {datRate && <DatRateCard datRate={datRate} />}

      <div className="rounded-2xl border border-border bg-panel p-5">
        {medianRate !== null && (
          <div className="mb-4">
            <div className="font-mono-brand text-3xl font-bold text-teal">{money(medianRate)}</div>
            <div className="text-textTertiary text-[0.64rem] uppercase tracking-wide">
              Median Line Haul · {historical.length} shipment(s)
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-textSecondary text-xs uppercase">
                <th className="py-1 pr-3">Origin</th>
                <th className="py-1 pr-3">Destination</th>
                <th className="py-1 pr-3">Company</th>
                <th className="py-1 pr-3">Ship Date</th>
                <th className="py-1 pr-3">Load Type</th>
                <th className="py-1 pr-3">Line Haul</th>
                <th className="py-1 pr-3">Addl. Charges</th>
                <th className="py-1 pr-3">Carrier Pay</th>
                <th className="py-1 pr-3">Net Profit</th>
                <th className="py-1 pr-3">%</th>
              </tr>
            </thead>
            <tbody>
              {historical.map((d, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1 pr-3">{d.origin}</td>
                  <td className="py-1 pr-3">{d.destination}</td>
                  <td className="py-1 pr-3">{d.company || "—"}</td>
                  <td className="py-1 pr-3">{d.shipDate}</td>
                  <td className="py-1 pr-3">{d.loadType || "—"}</td>
                  <td className="py-1 pr-3">{money(d.lineHaul)}</td>
                  <td className="py-1 pr-3">{money(d.additionalCharges)}</td>
                  <td className="py-1 pr-3">{money(d.carrierPay)}</td>
                  <td className="py-1 pr-3">{money(d.netProfit)}</td>
                  <td className="py-1 pr-3">{d.pct != null ? `${d.pct.toFixed(1)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}