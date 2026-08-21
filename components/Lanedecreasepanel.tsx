"use client";

import { useEffect, useState } from "react";
import { getLaneLoadChanges } from "@/lib/api";
import type { LaneLoadChangeRow } from "@/lib/types";

const DEFAULT_THRESHOLD = 20;

function formatMonth(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export default function LaneDecreasePanel({ company }: { company: string }) {
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<LaneLoadChangeRow[]>([]);

  useEffect(() => {
    if (!company) return;
    setLoading(true);
    setError(null);
    getLaneLoadChanges(company, threshold)
      .then((res) => setRows(res.rows))
      .catch((e: any) => setError(e.message || "Couldn't load lane changes"))
      .finally(() => setLoading(false));
  }, [company, threshold]);

  return (
    <div className="rounded-2xl border border-border bg-panel p-5">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-lg text-textPrimary">Lanes with Significant Decreases</h2>
          <p className="text-textTertiary text-[0.64rem] uppercase tracking-wide">
            Month-over-month drop in load count
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-textSecondary">
          Threshold
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value) || 0)}
            className="w-20 rounded-md border border-borderBright bg-panel2 px-2 py-1.5 text-sm text-textPrimary outline-none focus:border-teal"
          />
          %
        </label>
      </div>

      {error && <div className="badge badge-unavailable mb-3">{error}</div>}

      {!company ? (
        <div className="text-textSecondary text-sm py-10 text-center">
          Select a customer to see their lane changes.
        </div>
      ) : loading ? (
        <div className="text-textSecondary text-sm py-10 text-center">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-textSecondary text-sm py-10 text-center">
          No lanes dropped by {threshold}% or more month-over-month.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-textSecondary text-xs uppercase">
                <th className="py-1 pr-3">Lane</th>
                <th className="py-1 pr-3">Prior Month</th>
                <th className="py-1 pr-3">New Month</th>
                <th className="py-1 pr-3">Prior Loads</th>
                <th className="py-1 pr-3">New Loads</th>
                <th className="py-1 pr-3">% Decrease</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1 pr-3">{r.lane}</td>
                  <td className="py-1 pr-3">{formatMonth(r.oldMonth)}</td>
                  <td className="py-1 pr-3">{formatMonth(r.newMonth)}</td>
                  <td className="py-1 pr-3">{r.oldCount}</td>
                  <td className="py-1 pr-3">{r.newCount}</td>
                  <td className="py-1 pr-3 text-red">{r.pctDecrease.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}