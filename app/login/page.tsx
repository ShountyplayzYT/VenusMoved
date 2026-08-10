"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, signup } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [signinPassword, setSigninPassword] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  async function handleSignin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(identifier, signinPassword);
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await signup(name, email, password);
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6">
        <div className="font-mono-brand text-xs uppercase tracking-[0.18em] text-teal mb-1">
          Dispatch Terminal
        </div>
        <h1 className="text-3xl font-semibold">Line Haul Voice Lookup</h1>
        <div className="text-textSecondary mt-1">Sign in to continue.</div>
      </div>
      <div className="hazard-rule mb-8" />

      <div className="grid gap-8 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-panel p-8 flex flex-col justify-center">
          <div className="font-mono-brand text-xs uppercase tracking-[0.18em] text-teal mb-2">
            Say a lane. Get a rate.
          </div>
          <h2 className="text-2xl font-semibold mb-3">Voice in, verified rate out.</h2>
          <p className="text-textSecondary text-sm leading-relaxed max-w-[34ch]">
            Speak an origin and destination. The terminal checks your own shipment
            history first — and only reaches for an AI estimate when no verified
            record exists.
          </p>
          <div className="flex gap-6 mt-8 pt-6 border-t border-border">
            <div>
              <div className="font-mono-brand text-xl font-bold text-amber">DB</div>
              <div className="text-[0.64rem] uppercase tracking-wider text-textTertiary">
                Verified first
              </div>
            </div>
            <div>
              <div className="font-mono-brand text-xl font-bold text-amber">AI</div>
              <div className="text-[0.64rem] uppercase tracking-wider text-textTertiary">
                Fallback estimate
              </div>
            </div>
            <div>
              <div className="font-mono-brand text-xl font-bold text-amber">Live</div>
              <div className="text-[0.64rem] uppercase tracking-wider text-textTertiary">
                Route + weather
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-8">
          <div className="flex gap-4 border-b border-border mb-6">
            <button
              onClick={() => setTab("signin")}
              className={`pb-3 text-sm font-mono-brand uppercase tracking-wide ${
                tab === "signin" ? "text-teal border-b-2 border-teal" : "text-textSecondary"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setTab("signup")}
              className={`pb-3 text-sm font-mono-brand uppercase tracking-wide ${
                tab === "signup" ? "text-teal border-b-2 border-teal" : "text-textSecondary"
              }`}
            >
              Create Account
            </button>
          </div>

          {tab === "signin" ? (
            <form onSubmit={handleSignin} className="space-y-4">
              <Field label="Email or Username" value={identifier} onChange={setIdentifier} />
              <Field
                label="Password"
                type="password"
                value={signinPassword}
                onChange={setSigninPassword}
              />
              <SubmitButton loading={loading}>Sign In</SubmitButton>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <Field label="Full Name" value={name} onChange={setName} />
              <Field label="Email" value={email} onChange={setEmail} />
              <Field label="Password" type="password" value={password} onChange={setPassword} />
              <Field
                label="Confirm Password"
                type="password"
                value={confirm}
                onChange={setConfirm}
              />
              <SubmitButton loading={loading}>Create Account</SubmitButton>
            </form>
          )}

          {error && (
            <div className="badge badge-unavailable mt-4">{error}</div>
          )}
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <div className="text-textSecondary text-xs uppercase tracking-wide mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full rounded-md border border-borderBright bg-panel2 px-3 py-2 text-textPrimary outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
      />
    </label>
  );
}

function SubmitButton({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-md bg-gradient-to-b from-[#ffc633] to-amber px-4 py-2 font-bold text-[#14100a] shadow-[0_1px_0_rgba(255,255,255,.35)_inset] disabled:opacity-60"
    >
      {loading ? "Please wait..." : children}
    </button>
  );
}
