"use client";

import { useEffect, useMemo, useState } from "react";
import { getQuoteHistory } from "@/lib/api";
import type { Quote } from "@/lib/types";

type Filters = { customer: string; from: string; to: string };
const EMPTY_FILTERS: Filters = { customer: "", from: "", to: "" };

function money(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function QuoteHistoryPanel({ refreshKey }: { refreshKey: number }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getQuoteHistory()
      .then((result) => setQuotes(result.rows))
      .catch((err: any) => setError(err.message || "Couldn't load quote history"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const customers = useMemo(
    () => Array.from(new Set(quotes.map((quote) => quote.customer))).sort((a, b) => a.localeCompare(b)),
    [quotes]
  );

  const filtered = useMemo(() => quotes.filter((quote) => {
    const day = quote.createdAt.slice(0, 10);
    return (!applied.customer || quote.customer === applied.customer)
      && (!applied.from || day >= applied.from)
      && (!applied.to || day <= applied.to);
  }), [quotes, applied]);

  function search() { setApplied({ ...draft }); }
  function clear() { setDraft(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); }

  return (
    <section className="rounded-2xl border border-border bg-panel p-5">
      <div className="mb-4">
        <h2 className="font-display text-lg">Quote History</h2>
        <p className="text-textTertiary text-[0.64rem] uppercase tracking-wide">Historical customer quotes</p>
      </div>

      <div className="grid gap-3 mb-4 sm:grid-cols-4">
        <select value={draft.customer} onChange={(e) => setDraft((filters) => ({ ...filters, customer: e.target.value }))} className="rounded-md border border-borderBright bg-panel2 px-3 py-2 text-sm text-textPrimary outline-none focus:border-teal">
          <option value="">All companies</option>
          {customers.map((customer) => <option key={customer} value={customer}>{customer}</option>)}
        </select>
        <input type="date" value={draft.from} onChange={(e) => setDraft((filters) => ({ ...filters, from: e.target.value }))} aria-label="From date" className="rounded-md border border-borderBright bg-panel2 px-3 py-2 text-sm outline-none focus:border-teal" />
        <input type="date" value={draft.to} onChange={(e) => setDraft((filters) => ({ ...filters, to: e.target.value }))} aria-label="To date" className="rounded-md border border-borderBright bg-panel2 px-3 py-2 text-sm outline-none focus:border-teal" />
        <div className="flex gap-2"><button type="button" onClick={search} className="rounded-md bg-gradient-to-b from-[#ffc633] to-amber px-4 py-2 text-sm font-bold text-[#14100a]">Search</button><button type="button" onClick={clear} className="rounded-md border border-borderBright bg-panel2 px-3 py-2 text-sm">Clear</button></div>
      </div>

      {error && <div className="badge badge-unavailable mb-3">{error}</div>}
      {loading ? <div className="text-textSecondary text-sm py-10 text-center">Loading…</div>
      : filtered.length === 0 ? <div className="text-textSecondary text-sm py-10 text-center">No quotes match these filters.</div>
      : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-textSecondary text-xs uppercase"><th className="py-1 pr-3">Date</th><th className="py-1 pr-3">Company</th><th className="py-1 pr-3">Origin</th><th className="py-1 pr-3">Destination</th><th className="py-1 pr-3">Quoted Rate</th><th className="py-1 pr-3">Quoted By</th></tr></thead><tbody>{filtered.map((quote) => <tr key={quote.id} className="border-t border-border"><td className="py-1.5 pr-3">{new Date(quote.createdAt).toLocaleDateString()}</td><td className="py-1.5 pr-3">{quote.customer}</td><td className="py-1.5 pr-3">{quote.origin}</td><td className="py-1.5 pr-3">{quote.destination}</td><td className="py-1.5 pr-3 text-teal">{money(quote.quotedRate)}</td><td className="py-1.5 pr-3">{quote.quotedBy}</td></tr>)}</tbody></table></div>}
    </section>
  );
}
