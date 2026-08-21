"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getMe, importReport } from "@/lib/api";
import type { ImportResult, User } from "@/lib/types";

export default function ImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    getMe().then((u) => {
      if (!u) router.push("/login");
      else setUser(u);
    });
  }, [router]);

  async function handleImport() {
    if (!file) {
      setError("Choose a report file first.");
      return;
    }
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await importReport(file);
      setResult(res);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      setError(e.message || "Import failed");
    } finally {
      setUploading(false);
    }
  }

  if (user === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center text-textSecondary">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex justify-between items-center mb-6">
        <Link href="/" className="text-textSecondary text-sm hover:text-teal">
          ← Back
        </Link>
      </div>

      <div className="mb-6">
        <div className="font-mono-brand text-xs uppercase tracking-[0.18em] text-teal mb-1">
          Data Import
        </div>
        <h1 className="text-2xl font-semibold">Import Customer Report</h1>
        <div className="text-textSecondary mt-1 text-sm max-w-[60ch]">
          Upload the raw, uncleaned report — the one still grouped by customer
          section. It'll be flattened into rows, each tagged with its company
          name. Loads that aren't already in the database get added; loads
          that already exist are left alone, except their Company gets
          filled in if it was empty.
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-panel p-5 mb-6">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xlsm"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full rounded-md border border-borderBright bg-panel2 px-3 py-2 text-textPrimary outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 mb-3 text-sm"
        />
        <button
          onClick={handleImport}
          disabled={uploading || !file}
          className="rounded-md bg-gradient-to-b from-[#ffc633] to-amber px-4 py-2 font-bold text-[#14100a] disabled:opacity-60"
        >
          {uploading ? "Importing..." : "Clean & Import"}
        </button>
      </div>

      {error && <div className="badge badge-unavailable mb-6">{error}</div>}

      {result && (
        <div className="rounded-2xl border border-border bg-panel p-5">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Stat label="Rows Parsed" value={result.parsed} />
            <Stat label="New Rows Added" value={result.inserted} />
            <Stat label="Already In DB" value={result.alreadyInDb} />
          </div>
          {result.companies.length > 0 && (
            <div>
              <div className="text-textTertiary text-[0.64rem] uppercase tracking-wide mb-2">
                Companies In This File ({result.companies.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {result.companies.map((c) => (
                  <span
                    key={c}
                    className="rounded-md border border-borderBright bg-panel2 px-2 py-1 text-xs text-textSecondary"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-mono-brand text-2xl font-bold text-teal">{value}</div>
      <div className="text-textTertiary text-[0.64rem] uppercase tracking-wide">{label}</div>
    </div>
  );
}