"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCustomerLaneWeeklyLoads,
  getCustomerWeeklyLoads,
  getInsightsCustomers,
} from "@/lib/api";
import MultiLineChart, { ChartSeries } from "./MultiLineChart";

const WEEKS_BACK = 26; // ~6 months

function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday ... 6 = Saturday
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Builds the last WEEKS_BACK Monday-aligned week-start dates (ascending),
// matching the Monday-Sunday buckets the backend computes with
// Postgres' date_trunc('week', ...).
function buildWeekGrid(weeksBack: number): string[] {
  const thisMonday = mondayOf(new Date());
  const weeks: string[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const d = new Date(thisMonday);
    d.setDate(thisMonday.getDate() - i * 7);
    weeks.push(d.toISOString().slice(0, 10));
  }
  return weeks;
}

function seriesTotal(s: ChartSeries) {
  return s.values.reduce((sum, v) => sum + v, 0);
}

function toSeries(
  weeks: string[],
  rows: { key: string; weekStart: string; loadCount: number }[]
): ChartSeries[] {
  const byKey = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!byKey.has(row.key)) byKey.set(row.key, new Map());
    byKey.get(row.key)!.set(row.weekStart, row.loadCount);
  }
  const series = Array.from(byKey.entries()).map(([key, wk]) => ({
    label: key,
    values: weeks.map((w) => wk.get(w) ?? 0),
  }));
  series.sort((a, b) => seriesTotal(b) - seriesTotal(a));
  return series;
}

export default function InsightsPanel() {
  const weeks = useMemo(() => buildWeekGrid(WEEKS_BACK), []);

  const [customerLoading, setCustomerLoading] = useState(true);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [customerSeries, setCustomerSeries] = useState<ChartSeries[]>([]);

  const [customers, setCustomers] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");

  const [laneLoading, setLaneLoading] = useState(false);
  const [laneError, setLaneError] = useState<string | null>(null);
  const [laneSeries, setLaneSeries] = useState<ChartSeries[]>([]);

  useEffect(() => {
    setCustomerLoading(true);
    setCustomerError(null);
    getCustomerWeeklyLoads()
      .then((res) => {
        const rows = res.rows.map((r) => ({
          key: r.company,
          weekStart: r.weekStart,
          loadCount: r.loadCount,
        }));
        setCustomerSeries(toSeries(weeks, rows));
      })
      .catch((e: any) => setCustomerError(e.message || "Couldn't load customer insights"))
      .finally(() => setCustomerLoading(false));

    getInsightsCustomers()
      .then((res) => {
        setCustomers(res.customers);
        setSelectedCustomer((prev) => prev || res.customers[0] || "");
      })
      .catch(() => {
        /* dropdown just stays empty; the chart above still works */
      });
  }, [weeks]);

  useEffect(() => {
    if (!selectedCustomer) return;
    setLaneLoading(true);
    setLaneError(null);
    getCustomerLaneWeeklyLoads(selectedCustomer)
      .then((res) => {
        const rows = res.rows.map((r) => ({
          key: r.lane,
          weekStart: r.weekStart,
          loadCount: r.loadCount,
        }));
        setLaneSeries(toSeries(weeks, rows));
      })
      .catch((e: any) => setLaneError(e.message || "Couldn't load lane insights"))
      .finally(() => setLaneLoading(false));
  }, [selectedCustomer, weeks]);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border bg-panel p-5">
        <div className="mb-4">
          <h2 className="font-display text-lg text-textPrimary">Loads by Customer</h2>
          <p className="text-textTertiary text-[0.64rem] uppercase tracking-wide">
            Weekly load count · last 6 months
          </p>
        </div>
        {customerError && <div className="badge badge-unavailable mb-3">{customerError}</div>}
        {customerLoading ? (
          <div className="text-textSecondary text-sm py-10 text-center">Loading…</div>
        ) : (
          <MultiLineChart weeks={weeks} series={customerSeries} />
        )}
      </div>

      <div className="rounded-2xl border border-border bg-panel p-5">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-lg text-textPrimary">Loads by Lane</h2>
            <p className="text-textTertiary text-[0.64rem] uppercase tracking-wide">
              Weekly load count per lane · last 6 months
            </p>
          </div>
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="rounded-md border border-borderBright bg-panel2 px-3 py-1.5 text-sm text-textPrimary outline-none focus:border-teal"
          >
            {customers.length === 0 && <option value="">No customers</option>}
            {customers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        {laneError && <div className="badge badge-unavailable mb-3">{laneError}</div>}
        {!selectedCustomer ? (
          <div className="text-textSecondary text-sm py-10 text-center">
            Select a customer to see their lanes.
          </div>
        ) : laneLoading ? (
          <div className="text-textSecondary text-sm py-10 text-center">Loading…</div>
        ) : (
          <MultiLineChart weeks={weeks} series={laneSeries} />
        )}
      </div>
    </div>
  );
}