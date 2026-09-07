"use client";

import { useEffect, useState } from "react";
import { getAllLaneLoadChanges } from "@/lib/api";
import type { AllLaneLoadChangeRow } from "@/lib/types";

function formatMonth(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export default function LaneDecreasePanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AllLaneLoadChangeRow[]>([]);

  useEffect(() => {
    getAllLaneLoadChanges()
      .then((res) => setRows(res.rows))
      .catch((e: any) => setError(e.message || "Couldn't load lane changes"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-panel p-5">
      <div className="mb-4">
        <h2 className="font-display text-lg text-textPrimary">Lane Load Decreases</h2>
        <p className="text-textTertiary text-[0.64rem] uppercase tracking-wide">
          All companies · previous two completed months · 20%–50% decrease
        </p>
      </div>

      {error && <div className="badge badge-unavailable mb-3">{error}</div>}
      {loading ? (
        <div className="text-textSecondary text-sm py-10 text-center">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-textSecondary text-sm py-10 text-center">
          No lanes decreased between 20% and 50% over these two months.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-textSecondary text-xs uppercase">
                <th className="py-1 pr-3">Company</th>
                <th className="py-1 pr-3">Lane</th>
                <th className="py-1 pr-3">Prior Month</th>
                <th className="py-1 pr-3">New Month</th>
                <th className="py-1 pr-3">Prior Loads</th>
                <th className="py-1 pr-3">New Loads</th>
                <th className="py-1 pr-3">Decreased By</th>
                <th className="py-1 pr-3">% Decrease</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.company}-${row.lane}`} className="border-t border-border">
                  <td className="py-1.5 pr-3 text-textPrimary">{row.company}</td>
                  <td className="py-1.5 pr-3">{row.lane}</td>
                  <td className="py-1.5 pr-3">{formatMonth(row.oldMonth)}</td>
                  <td className="py-1.5 pr-3">{formatMonth(row.newMonth)}</td>
                  <td className="py-1.5 pr-3">{row.oldCount}</td>
                  <td className="py-1.5 pr-3">{row.newCount}</td>
                  <td className="py-1.5 pr-3 text-red">{row.decreaseCount} loads</td>
                  <td className="py-1.5 pr-3 text-red">{row.pctDecrease.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
