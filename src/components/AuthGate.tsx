"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock } from "lucide-react";

interface AuthGateProps {
  children: React.ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const check = useCallback(async () => {
    try {
      const r = await fetch("/api/session", { cache: "no-store" });
      const d = await r.json();
      setAuthed(Boolean(d.authed));
    } catch {
      setAuthed(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    check();
  }, [check]);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      if (r.ok) {
        setAuthed(true);
        setPassword("");
      } else {
        const d = await r.json().catch(() => ({}));
        setError(d.error || "Credenciais inválidas.");
      }
    } catch {
      setError("Não foi possível contactar o servidor.");
    } finally {
      setSubmitting(false);
    }
  }, [user, password, submitting]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="animate-pulse text-sm text-gray-500">A carregar…</div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <form
          onSubmit={submit}
          className="w-full max-w-sm rounded-xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl backdrop-blur-md"
        >
          <div className="mb-5 flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
              <Lock className="h-6 w-6 text-amber-400" />
            </div>
            <h1 className="text-lg font-extrabold tracking-wide text-white">Calculadora OFFSET RP</h1>
            <p className="text-center text-xs text-gray-500">Acesso restrito — inicia sessão para continuar.</p>
          </div>

          <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">Utilizador (opcional)</label>
          <input
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete="username"
            className="mb-3 w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-amber-400/50 focus:outline-none"
            placeholder="ex.: joao"
          />

          <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">Palavra-passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-amber-400/50 focus:outline-none"
            placeholder="••••••••"
          />

          {error && (
            <div className="mt-3 rounded border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-400">{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting || !password}
            className="mt-4 w-full rounded bg-amber-500 py-2.5 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "A entrar…" : "Entrar"}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
