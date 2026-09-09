"use client";

import { useEffect, useMemo, useState } from "react";
import { getCustomerMonthlyLoads } from "@/lib/api";
import type { CustomerMonthlyLoadRow } from "@/lib/types";
import LaneDecreasePanel from "./Lanedecreasepanel";

type CustomerLoadRow = {
  company: string;
  oldCount: number;
  newCount: number;
  changeCount: number;
  pctChange: number | null;
};

function formatMonth(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function makeCustomerRows(rows: CustomerMonthlyLoadRow[], months: string[]): CustomerLoadRow[] {
  const byCompany = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!byCompany.has(row.company)) byCompany.set(row.company, new Map());
    byCompany.get(row.company)!.set(row.monthStart, row.loadCount);
  }

  return Array.from(byCompany.entries())
    .map(([company, counts]) => {
      const oldCount = counts.get(months[0]) ?? 0;
      const newCount = counts.get(months[1]) ?? 0;
      const changeCount = newCount - oldCount;
      return {
        company,
        oldCount,
        newCount,
        changeCount,
        pctChange: oldCount > 0 ? (changeCount / oldCount) * 100 : null,
      };
    })
    .sort(
      (a, b) =>
        Math.abs(b.pctChange ?? 0) - Math.abs(a.pctChange ?? 0) ||
        Math.abs(b.changeCount) - Math.abs(a.changeCount) ||
        a.company.localeCompare(b.company)
    );
}

export default function InsightsPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState<string[]>([]);
  const [customerRows, setCustomerRows] = useState<CustomerLoadRow[]>([]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getCustomerMonthlyLoads()
      .then((res) => {
        const startMonth = res.startDate;
        const endMonth = new Date(`${res.endDate}T00:00:00`);
        endMonth.setMonth(endMonth.getMonth() - 1);
        const lastCompletedMonth = `${endMonth.getFullYear()}-${String(endMonth.getMonth() + 1).padStart(2, "0")}-01`;
        const period = [startMonth, lastCompletedMonth];
        setMonths(period);
        setCustomerRows(makeCustomerRows(res.rows, period));
      })
      .catch((e: any) => setError(e.message || "Couldn't load customer insights"))
      .finally(() => setLoading(false));
  }, []);

  const monthLabels = useMemo(() => months.map(formatMonth), [months]);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border bg-panel p-5">
        <div className="mb-4">
          <h2 className="font-display text-lg text-textPrimary">Customer Load Changes</h2>
          <p className="text-textTertiary text-[0.64rem] uppercase tracking-wide">
            All customers · previous two completed months
          </p>
        </div>

        {error && <div className="badge badge-unavailable mb-3">{error}</div>}
        {loading ? (
          <div className="text-textSecondary text-sm py-10 text-center">Loading…</div>
        ) : customerRows.length === 0 ? (
          <div className="text-textSecondary text-sm py-10 text-center">No customer loads for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-textSecondary text-xs uppercase">
                  <th className="py-1 pr-3">Company</th>
                  <th className="py-1 pr-3">{monthLabels[0]} Loads</th>
                  <th className="py-1 pr-3">{monthLabels[1]} Loads</th>
                  <th className="py-1 pr-3">Load Change</th>
                  <th className="py-1 pr-3">% Change</th>
                </tr>
              </thead>
              <tbody>
                {customerRows.map((row) => (
                  <tr key={row.company} className="border-t border-border">
                    <td className="py-1.5 pr-3 text-textPrimary">{row.company}</td>
                    <td className="py-1.5 pr-3">{row.oldCount}</td>
                    <td className="py-1.5 pr-3">{row.newCount}</td>
                    <td className={`py-1.5 pr-3 ${row.changeCount > 0 ? "text-teal" : row.changeCount < 0 ? "text-red" : "text-textSecondary"}`}>
                      {row.changeCount > 0 ? `+${row.changeCount}` : row.changeCount}
                    </td>
                    <td className={`py-1.5 pr-3 ${row.pctChange != null ? row.pctChange > 0 ? "text-teal" : row.pctChange < 0 ? "text-red" : "text-textSecondary" : "text-textSecondary"}`}>
                      {row.pctChange != null ? `${row.pctChange > 0 ? "+" : ""}${row.pctChange.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <LaneDecreasePanel />
    </div>
  );
}
