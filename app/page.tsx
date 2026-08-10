"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, logout, lookup } from "@/lib/api";
import type { LookupResponse, User } from "@/lib/types";
import AudioRecorder from "@/components/AudioRecorder";
import ResultsPanel from "@/components/ResultsPanel";

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [authError, setAuthError] = useState<string | null>(null);

  const [laneText, setLaneText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResponse | null>(null);

  useEffect(() => {
    getMe()
      .then((u) => {
        if (!u) {
          router.push("/login");
        } else {
          setUser(u);
        }
      })
      .catch((e: any) => {
        setAuthError(e.message || "Could not reach the server");
      });
  }, [router]);

  async function handleProcess() {
    if (!laneText.trim()) {
      setError("No text to process.");
      return;
    }
    setProcessing(true);
    setError(null);
    setResult(null);
    try {
      const res = await lookup(laneText);
      setResult(res);
    } catch (e: any) {
      setError(e.message || "Lookup failed");
    } finally {
      setProcessing(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  if (authError) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md text-center">
          <span className="badge badge-unavailable mb-3">Couldn&apos;t reach the server</span>
          <p className="text-textSecondary text-sm">{authError}</p>
        </div>
      </main>
    );
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
      <div className="flex justify-end mb-6">
        <button
          onClick={handleLogout}
          className="rounded-md border border-borderBright bg-panel2 px-3 py-1.5 text-xs text-textSecondary"
        >
          Log out
        </button>
      </div>

      <div className="flex justify-center mb-6">
        <AudioRecorder onTranscriptChange={setLaneText} />
      </div>

      <div className="mb-6">
        <input
          value={laneText}
          onChange={(e) => setLaneText(e.target.value)}
          placeholder="Type or say a lane, e.g. Sayreville to Boston"
          className="w-full rounded-md border border-borderBright bg-panel2 px-3 py-2 text-textPrimary outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 mb-3"
        />
        <button
          onClick={handleProcess}
          disabled={processing}
          className="rounded-md bg-gradient-to-b from-[#ffc633] to-amber px-4 py-2 font-bold text-[#14100a] disabled:opacity-60"
        >
          {processing ? "Processing…" : "Process"}
        </button>
      </div>

      {error && <div className="badge badge-unavailable mb-6">{error}</div>}

      {result && <ResultsPanel result={result} />}
    </main>
  );
}
