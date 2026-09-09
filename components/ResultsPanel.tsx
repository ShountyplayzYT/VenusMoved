"use client";

import type { LookupResponse } from "@/lib/types";

function money(v: number | null | undefined) {
  return v === null || v === undefined
    ? "—"
    : `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// Per-mile rates need real precision - rounding $5.74 to $6 is a ~5%
// error on numbers people are comparing directly against the portal.
function moneyPerMile(v: number | null | undefined) {
  return v === null || v === undefined
    ? "—"
    : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function DatRateCard({ datRate }: { datRate: NonNullable<LookupResponse["datRate"]> }) {
  return (
    <section className="rounded-2xl border border-border bg-panel p-5 mb-4">
      <h2 className="font-display text-lg text-textPrimary mb-4">DAT RateView</h2>
      <div className="mb-4">
        <div className="font-mono-brand text-3xl font-bold text-teal">
          {money(datRate.perTripRateUsd)}
        </div>
        <div className="text-textTertiary text-[0.64rem] uppercase tracking-wide">
          Per trip · DAT RateView estimate · all-in with fuel
          {datRate.rateType ? ` · ${datRate.rateType}` : ""}
        </div>
        {datRate.perMileRateUsd != null && (
          <div className="text-textSecondary text-xs mt-1">
            {moneyPerMile(datRate.perMileRateUsd)}/mi
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <div>
          <span className="text-textSecondary">Distance: </span>
          {datRate.mileage != null ? `${datRate.mileage} mi` : "—"}
        </div>
        <div>
          <span className="text-textSecondary">Reports: </span>
          {datRate.reports ?? "—"}
        </div>
        <div>
          <span className="text-textSecondary">Companies: </span>
          {datRate.companies ?? "—"}
        </div>
      </div>
    </section>
  );
}

export default function ResultsPanel({ result }: { result: LookupResponse }) {
  const { historical, datRate, parsed, datParsed } = result;
  const datLane = datParsed ?? parsed;

  const validRates = (historical || [])
    .map((d) => d.lineHaul)
    .filter((v): v is number => v !== null && v !== undefined);
  const medianRate = median(validRates);

  return (
    <>
      <section className="rounded-2xl border border-border bg-panel p-5 mb-4">
        <h2 className="font-display text-lg text-textPrimary mb-3">Final AI Locations</h2>
        <p className="text-textSecondary text-sm mb-3">The exact origin and destination supplied to each lookup.</p>
        <div className="grid gap-4 sm:grid-cols-2 text-sm">
          <div className="rounded-md border border-border bg-panel2 p-3">
            <div className="text-textTertiary text-[0.64rem] uppercase tracking-wide mb-2">ITS Database</div>
            <div><span className="text-textSecondary">Origin: </span><span className="text-textPrimary">{parsed.origin}</span></div>
            <div><span className="text-textSecondary">Destination: </span><span className="text-textPrimary">{parsed.destination}</span></div>
          </div>
          <div className="rounded-md border border-border bg-panel2 p-3">
            <div className="text-textTertiary text-[0.64rem] uppercase tracking-wide mb-2">DAT RateView</div>
            <div><span className="text-textSecondary">Origin: </span><span className="text-textPrimary">{datLane.origin}</span></div>
            <div><span className="text-textSecondary">Destination: </span><span className="text-textPrimary">{datLane.destination}</span></div>
          </div>
        </div>
      </section>
      {/* Always show the DAT market estimate alongside our own history,
          even when we found an exact or state-level match. */}
      {datRate ? <DatRateCard datRate={datRate} /> : (
        <section className="rounded-2xl border border-border bg-panel p-5 mb-4">
          <h2 className="font-display text-lg text-textPrimary mb-2">DAT RateView</h2>
          <p className="text-textSecondary text-sm">No DAT market rate is available for this lane.</p>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-panel p-5">
        <h2 className="font-display text-lg text-textPrimary mb-4">ITS Historical Loads</h2>
        {!historical || historical.length === 0 ? (
          <p className="text-textSecondary text-sm">No matching ITS shipments found for this lane.</p>
        ) : <>
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
        </>}
      </section>
    </>
  );
}
