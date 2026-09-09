"use client";

import { useEffect, useMemo, useState } from "react";
import { deleteQuote, getQuoteHistory, setQuoteOutcome } from "@/lib/api";
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
  const [updatingId, setUpdatingId] = useState<number | null>(null);

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
  async function setOutcome(quoteId: number, outcome: "won" | "lost") {
    setUpdatingId(quoteId); setError(null);
    try { await setQuoteOutcome(quoteId, outcome); setQuotes((rows) => rows.map((quote) => quote.id === quoteId ? { ...quote, outcome } : quote)); }
    catch (err: any) { setError(err.message || "Couldn't update quote"); }
    finally { setUpdatingId(null); }
  }
  async function remove(quoteId: number) {
    if (!window.confirm("Delete this quote? This cannot be undone.")) return;
    setUpdatingId(quoteId); setError(null);
    try { await deleteQuote(quoteId); setQuotes((rows) => rows.filter((quote) => quote.id !== quoteId)); }
    catch (err: any) { setError(err.message || "Couldn't delete quote"); }
    finally { setUpdatingId(null); }
  }

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
      : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-textSecondary text-xs uppercase"><th className="py-1 pr-3">Date</th><th className="py-1 pr-3">Company</th><th className="py-1 pr-3">Origin</th><th className="py-1 pr-3">Destination</th><th className="py-1 pr-3">Quoted Rate</th><th className="py-1 pr-3">Quoted By</th><th className="py-1 pr-3">Actions</th></tr></thead><tbody>{filtered.map((quote) => {
        const rowColor = quote.outcome === "won" ? "bg-teal/15" : quote.outcome === "lost" ? "bg-red/15" : "";
        const busy = updatingId === quote.id;
        return <tr key={quote.id} className={`border-t border-border ${rowColor}`}><td className="py-1.5 pr-3">{new Date(quote.createdAt).toLocaleDateString()}</td><td className="py-1.5 pr-3">{quote.customer}</td><td className="py-1.5 pr-3">{quote.origin}</td><td className="py-1.5 pr-3">{quote.destination}</td><td className="py-1.5 pr-3 text-teal">{money(quote.quotedRate)}</td><td className="py-1.5 pr-3">{quote.quotedBy}</td><td className="py-1.5 pr-3"><div className="flex gap-2"><button disabled={busy} onClick={() => setOutcome(quote.id, "won")} className="rounded bg-teal px-2 py-1 text-xs font-semibold text-[#071412] disabled:opacity-60">Win</button><button disabled={busy} onClick={() => setOutcome(quote.id, "lost")} className="rounded bg-red px-2 py-1 text-xs font-semibold text-white disabled:opacity-60">Loss</button><button disabled={busy} onClick={() => remove(quote.id)} className="rounded border border-red/70 px-2 py-1 text-xs text-red disabled:opacity-60">Delete</button></div></td></tr>;
      })}</tbody></table></div>}
    </section>
  );
}
