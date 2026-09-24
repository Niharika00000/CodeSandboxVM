"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/config";

export default function Home() {
  const router = useRouter();
  const [joinId, setJoinId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/rooms`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not create room");
      const { roomId } = (await res.json()) as { roomId: string };
      router.push(`/room/${roomId}`);
    } catch (e) {
      setError(`${(e as Error).message}. Is the server running on ${API_URL}?`);
      setBusy(false);
    }
  };

  const join = (e: React.FormEvent) => {
    e.preventDefault();
    const id = joinId.trim().split("/").pop() ?? "";
    if (/^[A-Za-z0-9_-]{8,16}$/.test(id)) router.push(`/room/${id}`);
    else setError("Please enter a valid room ID or link.");
  };

  return (
    <main className="min-h-screen bg-[#0a0c10] text-[#d6dae3] flex flex-col justify-center items-center px-4 relative overflow-hidden select-none">
      {/* Background ambient decorative glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-accent/15 via-[#7c6dff]/15 to-transparent blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-xl z-10 space-y-8">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-panel/80 px-3 py-1 text-xs text-dim shadow-sm backdrop-blur">
            <span className="flex h-2 w-2 rounded-full bg-ok animate-pulse" />
            <span>Real-time Collaborative Cloud Sandbox</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-fg">
            Sandbox<span className="bg-gradient-to-r from-accent to-[#a78bfa] bg-clip-text text-transparent">Room</span>
          </h1>

          <p className="text-sm text-dim leading-relaxed max-w-md mx-auto">
            Code simultaneously in Monaco, run programs in isolated micro-containers with instant stdout/stdin, and debug with integrated AI.
          </p>
        </div>

        {/* Action Card */}
        <div className="rounded-2xl border border-line bg-[#11141c]/90 p-6 sm:p-8 shadow-2xl backdrop-blur space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={create}
              disabled={busy}
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-[#5a95f5] px-6 py-3 font-semibold text-bg hover:brightness-110 disabled:opacity-50 transition-all shadow-lg shadow-accent/20 text-sm"
            >
              {busy ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-bg" />
                  Creating Room…
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Create Instant Room</span>
                </>
              )}
            </button>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line/70" />
            </div>
            <div className="relative bg-[#11141c] px-3 text-[11px] uppercase tracking-wider text-dim">
              or join existing
            </div>
          </div>

          <form onSubmit={join} className="flex gap-2">
            <input
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              placeholder="Paste room ID or full link"
              aria-label="Room ID or link"
              className="flex-1 rounded-xl border border-line bg-[#0a0c10] px-4 py-2.5 text-sm text-fg placeholder:text-dim/60 outline-none focus:border-accent transition-colors"
            />
            <button
              type="submit"
              disabled={!joinId.trim()}
              className="rounded-xl border border-line bg-raised px-5 py-2.5 text-sm font-medium text-fg hover:bg-raised/80 hover:border-accent disabled:opacity-40 transition-all"
            >
              Join
            </button>
          </form>

          {error && (
            <div role="alert" className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-xs text-bad">
              {error}
            </div>
          )}
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl border border-line/60 bg-panel/40 p-3">
            <span className="text-lg block mb-1">⚡</span>
            <div className="text-xs font-semibold text-fg">Multi-Language</div>
            <div className="text-[10px] text-dim mt-0.5">JS, TS, Python, C++, Go, Rust</div>
          </div>
          <div className="rounded-xl border border-line/60 bg-panel/40 p-3">
            <span className="text-lg block mb-1">👥</span>
            <div className="text-xs font-semibold text-fg">Live Presence</div>
            <div className="text-[10px] text-dim mt-0.5">CRDT Y.js sync & cursors</div>
          </div>
          <div className="rounded-xl border border-line/60 bg-panel/40 p-3">
            <span className="text-lg block mb-1">🤖</span>
            <div className="text-xs font-semibold text-fg">AI Intelligence</div>
            <div className="text-[10px] text-dim mt-0.5">Code review & auto-complete</div>
          </div>
        </div>
      </div>
    </main>
  );
}
