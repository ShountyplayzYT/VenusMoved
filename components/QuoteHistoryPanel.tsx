"use client";

import { useEffect, useMemo, useState } from "react";
import { getQuoteHistory } from "@/lib/api";
import type { Quote } from "@/lib/types";

function money(value: number) { return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export default function QuoteHistoryPanel({ refreshKey }: { refreshKey: number }) {
  const [quotes, setQuotes] = useState<Quote[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  useEffect(() => { setLoading(true); getQuoteHistory().then((result) => setQuotes(result.rows)).catch((err: any) => setError(err.message || "Couldn't load quote history")).finally(() => setLoading(false)); }, [refreshKey]);
  const filtered = useMemo(() => quotes.filter((quote) => {
    const haystack = `${quote.customer} ${quote.origin} ${quote.destination} ${quote.quotedBy}`.toLowerCase();
    const day = quote.createdAt.slice(0, 10);
    return (!search || haystack.includes(search.toLowerCase())) && (!from || day >= from) && (!to || day <= to);
  }), [quotes, search, from, to]);
  return <section className="rounded-2xl border border-border bg-panel p-5"><div className="mb-4"><h2 className="font-display text-lg">Quote History</h2><p className="text-textTertiary text-[0.64rem] uppercase tracking-wide">Historical customer quotes</p></div>
    <div className="grid gap-3 mb-4 sm:grid-cols-3"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer or lane" className="rounded-md border border-borderBright bg-panel2 px-3 py-2 text-sm outline-none focus:border-teal" />
      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-borderBright bg-panel2 px-3 py-2 text-sm outline-none focus:border-teal" />
      <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-borderBright bg-panel2 px-3 py-2 text-sm outline-none focus:border-teal" /></div>
    {error && <div className="badge badge-unavailable mb-3">{error}</div>}{loading ? <div className="text-textSecondary text-sm py-10 text-center">Loading…</div> : filtered.length === 0 ? <div className="text-textSecondary text-sm py-10 text-center">No quotes match these filters.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-textSecondary text-xs uppercase"><th className="py-1 pr-3">Date</th><th className="py-1 pr-3">Customer</th><th className="py-1 pr-3">Origin</th><th className="py-1 pr-3">Destination</th><th className="py-1 pr-3">Quoted Rate</th><th className="py-1 pr-3">Quoted By</th></tr></thead><tbody>{filtered.map((quote) => <tr key={quote.id} className="border-t border-border"><td className="py-1.5 pr-3">{new Date(quote.createdAt).toLocaleDateString()}</td><td className="py-1.5 pr-3">{quote.customer}</td><td className="py-1.5 pr-3">{quote.origin}</td><td className="py-1.5 pr-3">{quote.destination}</td><td className="py-1.5 pr-3 text-teal">{money(quote.quotedRate)}</td><td className="py-1.5 pr-3">{quote.quotedBy}</td></tr>)}</tbody></table></div>}</section>;
}
