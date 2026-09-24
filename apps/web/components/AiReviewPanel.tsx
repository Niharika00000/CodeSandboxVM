"use client";
import { useEffect, useRef, useState } from "react";

export interface ReviewIssue {
  severity: "error" | "warning" | "info";
  line?: number;
  message: string;
}

export interface ReviewSuggestion {
  title: string;
  description: string;
  code?: string;
}

export interface ReviewResult {
  summary: string;
  score: number;
  issues: ReviewIssue[];
  suggestions: ReviewSuggestion[];
}

interface Props {
  open: boolean;
  loading: boolean;
  result: ReviewResult | null;
  error: string | null;
  filename: string;
  onClose: () => void;
  onRefresh?: () => void;
  onApplyCode?: (code: string) => void;
  embedded?: boolean;
}

const SEVERITY_CONFIG = {
  error:   { label: "Error",   bg: "bg-[#ff4444]/15", text: "text-[#ff6666]", dot: "bg-[#ff4444]", icon: "✕" },
  warning: { label: "Warning", bg: "bg-[#ffaa00]/15", text: "text-[#ffaa00]", dot: "bg-[#ffaa00]", icon: "!" },
  info:    { label: "Info",    bg: "bg-[#4488ff]/15", text: "text-[#5599ff]", dot: "bg-[#4488ff]", icon: "i" },
};

function ScoreRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = (score / 10) * circ;
  const color =
    score >= 8 ? "#22c55e" :
    score >= 5 ? "#f59e0b" :
                 "#ef4444";
  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg width="72" height="72" className="-rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-bold leading-none" style={{ color }}>{score.toFixed(1)}</span>
        <span className="text-[10px] text-dim">/10</span>
      </div>
    </div>
  );
}

function CodeBlockWithCopy({ code, onApply }: { code: string; onApply?: (code: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const handleApply = () => {
    if (onApply) {
      onApply(code);
      setApplied(true);
      setTimeout(() => setApplied(false), 2000);
    }
  };
  return (
    <div className="relative border-t border-line bg-[#0a0c10]">
      <div className="flex justify-between items-center px-3 py-1 bg-white/5 border-b border-white/5 text-[10px] text-dim">
        <span>Suggested Fix</span>
        <div className="flex items-center gap-1.5">
          {onApply && (
            <button
              onClick={handleApply}
              className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-all ${
                applied
                  ? "bg-ok text-bg"
                  : "bg-accent/20 border border-accent/40 text-accent hover:bg-accent/30"
              }`}
            >
              {applied ? "✓ Applied" : "⚡ Apply Fix"}
            </button>
          )}
          <button
            onClick={copy}
            className="hover:text-fg text-[10px] px-1.5 py-0.5 rounded bg-raised border border-line/60"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
      </div>
      <pre className="px-3 py-2 overflow-x-auto">
        <code className="font-mono text-[11px] leading-relaxed text-[#a8d8a8]">{code}</code>
      </pre>
    </div>
  );
}

export default function AiReviewPanel({
  open,
  loading,
  result,
  error,
  filename,
  onClose,
  onRefresh,
  onApplyCode,
  embedded = false,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<"all" | "error" | "warning" | "info">("all");

  // Close on Escape only if not embedded
  useEffect(() => {
    if (embedded) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [embedded, onClose]);

  const errors   = result?.issues.filter(i => i.severity === "error") ?? [];
  const warnings = result?.issues.filter(i => i.severity === "warning") ?? [];
  const infos    = result?.issues.filter(i => i.severity === "info") ?? [];

  const filteredIssues = result?.issues.filter(i => filter === "all" || i.severity === filter) ?? [];

  const innerContent = (
    <>
      {/* Header if not embedded */}
      {!embedded && (
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🤖</span>
            <div>
              <h2 className="text-sm font-semibold">AI Code Review</h2>
              <p className="text-[11px] text-dim truncate max-w-[240px]">{filename}</p>
            </div>
          </div>
          <button
            id="ai-review-close"
            onClick={onClose}
            className="rounded p-1 text-dim hover:bg-line hover:text-fg transition-colors"
            aria-label="Close AI Review"
          >
            ✕
          </button>
        </div>
      )}

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#a78bfa]" />
              <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-[#a78bfa]/40" style={{ animationDirection: "reverse", animationDuration: "0.9s" }} />
            </div>
            <p className="text-sm font-medium text-fg">Analysing your code…</p>
            <p className="text-[11px] text-dim">Evaluating correctness, performance, and best practices</p>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="m-3 rounded-lg border border-[#ff4444]/30 bg-[#ff4444]/10 p-3.5">
            <p className="text-sm font-semibold text-[#ff6666]">Review failed</p>
            <p className="mt-1 text-xs text-dim leading-relaxed">{error}</p>
            <p className="mt-2 text-[11px] text-dim/80">
              Ensure <code className="font-mono bg-raised px-1 py-0.5 rounded text-fg">NVIDIA_API_KEY</code> is set in the server <code className="font-mono">.env</code>.
            </p>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="mt-3 rounded bg-[#ff4444]/20 border border-[#ff4444]/40 px-2.5 py-1 text-xs text-[#ff6666] hover:bg-[#ff4444]/30"
              >
                Retry Review
              </button>
            )}
          </div>
        )}

        {/* Result */}
        {!loading && result && (
          <div className="space-y-4 p-3">
            {/* Score + summary */}
            <div className="flex items-center gap-4 rounded-xl border border-line bg-raised/30 p-3.5">
              <div className="relative flex-shrink-0">
                <ScoreRing score={result.score} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-dim uppercase tracking-wider">Quality Score</p>
                  {onRefresh && (
                    <button
                      onClick={onRefresh}
                      title="Re-run review on current code"
                      className="text-[10px] text-accent hover:underline flex items-center gap-1"
                    >
                      <span>🔄</span> Re-analyze
                    </button>
                  )}
                </div>
                <p className="text-xs leading-relaxed mt-1 text-fg">{result.summary}</p>
              </div>
            </div>

            {/* Filter buttons */}
            {result.issues.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setFilter("all")}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    filter === "all" ? "bg-accent text-bg font-semibold" : "bg-raised text-dim hover:text-fg"
                  }`}
                >
                  All ({result.issues.length})
                </button>
                {errors.length > 0 && (
                  <button
                    onClick={() => setFilter("error")}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      filter === "error" ? "bg-[#ff4444] text-white font-semibold" : "bg-[#ff4444]/15 text-[#ff6666] hover:bg-[#ff4444]/25"
                    }`}
                  >
                    Errors ({errors.length})
                  </button>
                )}
                {warnings.length > 0 && (
                  <button
                    onClick={() => setFilter("warning")}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      filter === "warning" ? "bg-[#ffaa00] text-black font-semibold" : "bg-[#ffaa00]/15 text-[#ffaa00] hover:bg-[#ffaa00]/25"
                    }`}
                  >
                    Warnings ({warnings.length})
                  </button>
                )}
                {infos.length > 0 && (
                  <button
                    onClick={() => setFilter("info")}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      filter === "info" ? "bg-[#4488ff] text-white font-semibold" : "bg-[#4488ff]/15 text-[#5599ff] hover:bg-[#4488ff]/25"
                    }`}
                  >
                    Notes ({infos.length})
                  </button>
                )}
              </div>
            )}

            {/* Issues list */}
            {filteredIssues.length > 0 && (
              <section>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-dim">
                  Issues ({filteredIssues.length})
                </h3>
                <ul className="space-y-2">
                  {filteredIssues.map((issue, i) => {
                    const cfg = SEVERITY_CONFIG[issue.severity];
                    return (
                      <li key={i} className={`flex items-start gap-2.5 rounded-lg p-2.5 border border-line/40 ${cfg.bg}`}>
                        <span className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${cfg.dot} text-black`}>
                          {cfg.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold uppercase ${cfg.text}`}>{cfg.label}</span>
                            {issue.line !== undefined && (
                              <span className="rounded bg-black/30 px-1.5 py-0.2 font-mono text-[9px] text-fg">
                                Line {issue.line}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs leading-relaxed text-fg">{issue.message}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* Suggestions */}
            {result.suggestions.length > 0 && (
              <section>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-dim">
                  Improvement Suggestions ({result.suggestions.length})
                </h3>
                <ul className="space-y-3">
                  {result.suggestions.map((s, i) => (
                    <li key={i} className="rounded-lg border border-line bg-raised/20 overflow-hidden">
                      <div className="flex items-start gap-2.5 p-2.5">
                        <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-fg">{s.title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-dim">{s.description}</p>
                        </div>
                      </div>
                      {s.code && <CodeBlockWithCopy code={s.code} onApply={onApplyCode} />}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {result.issues.length === 0 && result.suggestions.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <span className="text-3xl">✅</span>
                <p className="text-sm font-medium">Clean Code!</p>
                <p className="text-xs text-dim">No syntax issues, bad patterns, or warnings detected.</p>
              </div>
            )}
          </div>
        )}

        {/* Idle state */}
        {!loading && !result && !error && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-4">
            <span className="text-3xl">🤖</span>
            <p className="text-sm font-semibold text-fg">AI Code Review Ready</p>
            <p className="text-xs text-dim leading-relaxed max-w-[260px]">
              Click below or use <strong className="text-accent">🔍 Review</strong> in the status bar to analyze the active code file.
            </p>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="mt-2 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-bg hover:brightness-110 shadow-sm transition-all"
              >
                Start Code Review
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-line px-3 py-2 text-[10px] text-dim/60 text-center bg-[#0d0f14]">
        Powered by NVIDIA NIM · {result ? `${result.issues.length} issue(s), ${result.suggestions.length} suggestion(s)` : "Ready to analyze"}
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col bg-panel" aria-label="AI Review panel">
        {innerContent}
      </div>
    );
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <aside
        ref={panelRef}
        aria-label="AI Code Review"
        className="fixed right-0 top-0 z-50 flex h-full w-[420px] max-w-full flex-col border-l border-line bg-[#0f1117] shadow-2xl"
      >
        {innerContent}
      </aside>
    </>
  );
}

