"use client";

import { useState } from "react";
import { createQuote } from "@/lib/api";

export default function QuoteModal({
  initial, onClose, onSaved,
}: {
  initial: { origin: string; destination: string; customer: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [origin, setOrigin] = useState(initial.origin);
  const [destination, setDestination] = useState(initial.destination);
  const [customer, setCustomer] = useState(initial.customer);
  const [quotedRate, setQuotedRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const rate = Number(quotedRate);
    if (!origin.trim() || !destination.trim() || !customer.trim() || !Number.isFinite(rate) || rate <= 0) {
      setError("Enter an origin, destination, customer, and positive quoted rate.");
      return;
    }
    setSaving(true); setError(null);
    try {
      await createQuote({ origin, destination, customer, quotedRate: rate });
      onSaved(); onClose();
    } catch (err: any) { setError(err.message || "Couldn't save quote"); }
    finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true">
    <form onSubmit={submit} className="w-full max-w-lg rounded-2xl border border-borderBright bg-panel p-5 shadow-xl">
      <div className="flex items-center justify-between gap-4 mb-4"><div><h2 className="font-display text-xl">Record Quote</h2><p className="text-textSecondary text-sm">Save the price shared with the customer.</p></div>
        <button type="button" onClick={onClose} className="text-textSecondary hover:text-textPrimary" aria-label="Close">✕</button></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Origin" value={origin} onChange={setOrigin} /><Field label="Destination" value={destination} onChange={setDestination} />
      </div>
      <Field label="Customer" value={customer} onChange={setCustomer} />
      <label className="block text-sm text-textSecondary mb-4">Quoted rate
        <input autoFocus type="number" min="0.01" step="0.01" value={quotedRate} onChange={(e) => setQuotedRate(e.target.value)} placeholder="0.00" className="mt-1 w-full rounded-md border border-borderBright bg-panel2 px-3 py-2 text-textPrimary outline-none focus:border-teal" />
      </label>
      {error && <div className="badge badge-unavailable mb-3">{error}</div>}
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-md border border-borderBright bg-panel2 px-4 py-2 text-sm">Cancel</button>
        <button disabled={saving} className="rounded-md bg-gradient-to-b from-[#ffc633] to-amber px-4 py-2 text-sm font-bold text-[#14100a] disabled:opacity-60">{saving ? "Saving…" : "Save Quote"}</button></div>
    </form>
  </div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm text-textSecondary mb-3">{label}<input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-md border border-borderBright bg-panel2 px-3 py-2 text-textPrimary outline-none focus:border-teal" /></label>;
}
