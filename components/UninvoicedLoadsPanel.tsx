"use client";

import { useEffect, useState } from "react";
import { getUninvoicedLoads } from "@/lib/api";
import type { UninvoicedLoad } from "@/lib/types";

function money(value: number | null) {
  return value == null ? "—" : `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function UninvoicedLoadsPanel() {
  const [rows, setRows] = useState<UninvoicedLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUninvoicedLoads()
      .then((result) => setRows(result.rows))
      .catch((err: any) => setError(err.message || "Couldn't load uninvoiced loads"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="rounded-2xl border border-border bg-panel p-5">
      <div className="mb-4">
        <h2 className="font-display text-lg text-textPrimary">Uninvoiced Loads</h2>
        <p className="text-textTertiary text-[0.64rem] uppercase tracking-wide">
          Loads with Line Haul = $0
        </p>
      </div>
      {error && <div className="badge badge-unavailable mb-3">{error}</div>}
      {loading ? <div className="text-textSecondary text-sm py-10 text-center">Loading…</div>
      : rows.length === 0 ? <div className="text-textSecondary text-sm py-10 text-center">No uninvoiced loads found.</div>
      : <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-textSecondary text-xs uppercase">
            <th className="py-1 pr-3">Load #</th><th className="py-1 pr-3">Origin</th><th className="py-1 pr-3">Destination</th>
            <th className="py-1 pr-3">Ship Date</th><th className="py-1 pr-3">Line Haul</th><th className="py-1 pr-3">Revenue</th>
          </tr></thead>
          <tbody>{rows.map((row) => <tr key={row.loadNumber} className="border-t border-border">
            <td className="py-1.5 pr-3">{row.loadNumber ?? "—"}</td><td className="py-1.5 pr-3">{row.origin ?? "—"}</td>
            <td className="py-1.5 pr-3">{row.destination ?? "—"}</td><td className="py-1.5 pr-3">{row.shipDate ?? "—"}</td>
            <td className="py-1.5 pr-3">{money(row.lineHaul)}</td><td className="py-1.5 pr-3">{money(row.revenue)}</td>
          </tr>)}</tbody>
        </table></div>}
    </section>
  );
}
