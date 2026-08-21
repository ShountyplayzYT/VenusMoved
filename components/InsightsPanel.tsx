"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCustomerLaneMonthlyLoads,
  getCustomerMonthlyLoads,
  getInsightsCustomers,
} from "@/lib/api";
import MultiLineChart, { ChartSeries } from "./MultiLineChart";
import LaneDecreasePanel from "./Lanedecreasepanel";

const MONTHS_BACK = 6;

function firstOfMonth(d: Date): Date {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

// Formats a Date as a plain YYYY-MM-DD string using its LOCAL calendar
// fields. We deliberately avoid `toISOString()` here: it converts to UTC
// first, which shifts the date backwards by one day in timezones ahead of
// UTC (e.g. IST) and breaks the match against the backend's naive SQL
// `date` values (date_trunc('month', ship_date)::date has no timezone).
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Builds the last MONTHS_BACK first-of-month dates (ascending), matching
// the calendar-month buckets the backend computes with Postgres'
// date_trunc('month', ...).
function buildMonthGrid(monthsBack: number): string[] {
  const thisMonthStart = firstOfMonth(new Date());
  const months: string[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(thisMonthStart.getFullYear(), thisMonthStart.getMonth() - i, 1);
    months.push(toDateKey(d));
  }
  return months;
}

function seriesTotal(s: ChartSeries) {
  return s.values.reduce((sum, v) => sum + v, 0);
}

function toSeries(
  months: string[],
  rows: { key: string; monthStart: string; loadCount: number }[]
): ChartSeries[] {
  const byKey = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!byKey.has(row.key)) byKey.set(row.key, new Map());
    byKey.get(row.key)!.set(row.monthStart, row.loadCount);
  }
  const series = Array.from(byKey.entries()).map(([key, mk]) => ({
    label: key,
    values: months.map((m) => mk.get(m) ?? 0),
  }));
  series.sort((a, b) => seriesTotal(b) - seriesTotal(a));
  return series;
}

export default function InsightsPanel() {
  const months = useMemo(() => buildMonthGrid(MONTHS_BACK), []);

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
    getCustomerMonthlyLoads()
      .then((res) => {
        const rows = res.rows.map((r) => ({
          key: r.company,
          monthStart: r.monthStart,
          loadCount: r.loadCount,
        }));
        setCustomerSeries(toSeries(months, rows));
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
  }, [months]);

  useEffect(() => {
    if (!selectedCustomer) return;
    setLaneLoading(true);
    setLaneError(null);
    getCustomerLaneMonthlyLoads(selectedCustomer)
      .then((res) => {
        const rows = res.rows.map((r) => ({
          key: r.lane,
          monthStart: r.monthStart,
          loadCount: r.loadCount,
        }));
        setLaneSeries(toSeries(months, rows));
      })
      .catch((e: any) => setLaneError(e.message || "Couldn't load lane insights"))
      .finally(() => setLaneLoading(false));
  }, [selectedCustomer, months]);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border bg-panel p-5">
        <div className="mb-4">
          <h2 className="font-display text-lg text-textPrimary">Loads by Customer</h2>
          <p className="text-textTertiary text-[0.64rem] uppercase tracking-wide">
            Monthly load count · last 6 months
          </p>
        </div>
        {customerError && <div className="badge badge-unavailable mb-3">{customerError}</div>}
        {customerLoading ? (
          <div className="text-textSecondary text-sm py-10 text-center">Loading…</div>
        ) : (
          <MultiLineChart months={months} series={customerSeries} />
        )}
      </div>

      <div className="rounded-2xl border border-border bg-panel p-5">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-lg text-textPrimary">Loads by Lane</h2>
            <p className="text-textTertiary text-[0.64rem] uppercase tracking-wide">
              Monthly load count per lane · last 6 months
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
          <MultiLineChart months={months} series={laneSeries} />
        )}
      </div>

      <LaneDecreasePanel company={selectedCustomer} />
    </div>
  );
}