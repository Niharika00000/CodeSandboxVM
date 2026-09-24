"use client";
import type { SandboxStatus } from "@sandbox/shared";
import type { ExecState } from "@/hooks/useRoom";

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-line bg-[#10131a] p-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-dim">{label}</div>
      <div className="mt-1 truncate font-mono text-xs font-semibold text-fg" title={value}>{value}</div>
      {sub && <div className="text-[10px] text-dim/70 truncate">{sub}</div>}
    </div>
  );
}

export default function SandboxPanel({
  exec,
  embedded = false,
}: {
  exec: ExecState;
  embedded?: boolean;
}) {
  const has = (s: SandboxStatus) => exec.statuses.includes(s);
  const finalLabel = exec.outcome === "timeout" ? "Timed out" : exec.outcome === "failed" ? "Failed" : "Completed";
  const finalDone = exec.outcome && exec.outcome !== "running";
  const isCompiled = has("COMPILING");

  const steps: { label: string; desc: string; icon: string; state: "done" | "active" | "todo" | "bad" }[] = [
    {
      label: "Creating",
      desc: "Allocating isolated container",
      icon: "📦",
      state: has("CREATING") ? (has("COMPILING") || has("RUNNING") || finalDone ? "done" : "active") : "todo",
    },
    ...(isCompiled ? [{
      label: "Compiling",
      desc: "Invoking language compiler",
      icon: "⚙️",
      state: (has("RUNNING") || finalDone ? "done" : "active") as "done" | "active",
    }] : []),
    {
      label: "Running",
      desc: "Streaming program execution",
      icon: "▶️",
      state: has("RUNNING") ? (finalDone ? "done" : "active") : "todo",
    },
    {
      label: finalDone ? finalLabel : "Completed",
      desc: finalDone ? (exec.outcome === "completed" ? "Exited cleanly" : "Terminated with error") : "Awaiting completion",
      icon: finalDone ? (exec.outcome === "completed" ? "✓" : "✕") : "🏁",
      state: finalDone ? (exec.outcome === "completed" ? "done" : "bad") : "todo",
    },
    {
      label: "Destroyed",
      desc: "Cleaned up ephemeral resources",
      icon: "🧹",
      state: has("DESTROYED") ? "done" : "todo",
    },
  ];

  const dot = {
    done: "bg-ok border-ok text-ok",
    active: "bg-warn border-warn text-warn shadow-lg shadow-warn/30 animate-pulse",
    todo: "bg-line border-line text-dim",
    bad: "bg-bad border-bad text-bad shadow-lg shadow-bad/30",
  } as const;

  const l = exec.limits;

  const content = (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto p-3 text-sm space-y-4">
      {/* Header info */}
      <div className="rounded-lg border border-line bg-raised/30 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">⚡</span>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-fg">Sandbox Lifecycle</h2>
              <p className="text-[11px] text-dim">Isolated container runtime</p>
            </div>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              exec.outcome === "running"
                ? "bg-warn/15 text-warn animate-pulse border border-warn/30"
                : exec.outcome === "completed"
                ? "bg-ok/15 text-ok border border-ok/30"
                : exec.outcome === "failed" || exec.outcome === "timeout"
                ? "bg-bad/15 text-bad border border-bad/30"
                : "bg-line/40 text-dim"
            }`}
          >
            {exec.outcome ?? "Ready"}
          </span>
        </div>
      </div>

      {/* Stepper Pipeline */}
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dim">Execution Steps</h3>
        <ol className="space-y-2">
          {steps.map((s, idx) => (
            <li
              key={s.label}
              className={`flex items-start gap-2.5 rounded-lg border p-2 text-xs transition-colors ${
                s.state === "active"
                  ? "border-warn/50 bg-warn/5"
                  : s.state === "done"
                  ? "border-ok/30 bg-ok/5"
                  : s.state === "bad"
                  ? "border-bad/40 bg-bad/5"
                  : "border-line/40 bg-[#0e1017] opacity-60"
              }`}
            >
              <div className="flex flex-col items-center">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold border ${dot[s.state]}`}>
                  {s.state === "done" ? "✓" : s.state === "bad" ? "✕" : idx + 1}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${s.state === "todo" ? "text-dim" : "text-fg"}`}>{s.label}</span>
                  <span className="text-[11px]">{s.icon}</span>
                </div>
                <p className="text-[10px] text-dim truncate">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Resource Metrics Grid */}
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dim">Sandbox Resources</h3>
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="CPU Quota" value={l ? `${l.cpus} core` : "0.5 core"} sub="Isolated CFS" />
          <MetricCard label="Memory Limit" value={l?.memory ?? "128m"} sub="Hard OOM cap" />
          <MetricCard label="Process Limit" value={l ? `${l.pids} PIDs` : "64 PIDs"} sub="Forkbomb shield" />
          <MetricCard label="Time Limit" value={l ? `${l.timeoutMs / 1000}s` : "5.0s"} sub="SIGKILL timer" />
          <MetricCard
            label="Duration"
            value={exec.durationMs !== undefined ? `${(exec.durationMs / 1000).toFixed(2)}s` : "-"}
            sub="Wall clock"
          />
          <MetricCard
            label="Exit Code"
            value={exec.exitCode !== undefined ? String(exec.exitCode) : "-"}
            sub={exec.exitCode === 0 ? "Success" : exec.exitCode ? "Error code" : "Not exited"}
          />
        </div>
      </div>

      {/* Ephemeral Environment Details */}
      <div className="rounded-lg border border-line/60 bg-[#0d0f14] p-3 text-[11px] text-dim space-y-1.5">
        <div className="flex justify-between">
          <span>Execution ID</span>
          <span className="font-mono text-fg text-[10px]">{exec.executionId ?? "none"}</span>
        </div>
        <div className="flex justify-between">
          <span>Network</span>
          <span className="text-ok font-medium">Disabled (Airgapped)</span>
        </div>
        <div className="flex justify-between">
          <span>Runtime</span>
          <span className="text-fg font-medium truncate max-w-[150px]">{l?.runtime ?? "docker (isolated)"}</span>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col bg-panel" aria-label="Sandbox status panel">
        {content}
      </div>
    );
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col overflow-auto border-l border-line bg-panel p-3 lg:flex" aria-label="Sandbox status">
      {content}
    </aside>
  );
}
