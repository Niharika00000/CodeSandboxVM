"use client";
import { useEffect, useRef, useState } from "react";
import type { ExecState } from "@/hooks/useRoom";

interface Props {
  exec: ExecState;
  onClear: () => void;
  onStdin: (data: string) => void;
  onExplainError?: (stderr: string) => Promise<{ explanation: string; fix?: string } | null>;
  onApplyFix?: (fix: string) => void;
  onApplyCode?: (fix: string) => void;
}

export default function Terminal({
  exec,
  onClear,
  onStdin,
  onExplainError,
  onApplyFix,
  onApplyCode,
}: Props) {
  const applyFix = onApplyFix || onApplyCode;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stdin, setStdin] = useState("");
  const [copied, setCopied] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<{ explanation: string; fix?: string } | null>(null);

  const running = exec.outcome === "running";

  // Safely auto-scroll output within the terminal without causing the page window to scroll horizontally
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [exec.chunks]);

  const color = { stdout: "text-fg", stderr: "text-bad", system: "text-dim" } as const;

  const copyOutput = async () => {
    const text = exec.chunks.map((c) => c.text).join("");
    if (text) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const hasStderr = exec.chunks.some((c) => c.kind === "stderr");
  const failed = exec.outcome === "failed" || hasStderr;

  const handleExplain = async () => {
    if (!onExplainError) return;
    const stderrText = exec.chunks
      .filter((c) => c.kind === "stderr")
      .map((c) => c.text)
      .join("") || exec.chunks.map((c) => c.text).join("");
    if (!stderrText) return;
    setExplaining(true);
    try {
      const result = await onExplainError(stderrText);
      setAiExplanation(result);
    } finally {
      setExplaining(false);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col border-t border-line bg-[#0c0d12]" aria-label="Terminal output">
      {/* Terminal Title Bar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-line bg-[#11131a] px-3 text-xs">
        <div className="flex items-center gap-2">
          {/* macOS window dots */}
          <div className="flex items-center gap-1.5 mr-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]/80 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]/80 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]/80 inline-block" />
          </div>
          <span className="font-mono text-[11px] font-semibold text-fg">Terminal</span>
          {running && (
            <span className="flex items-center gap-1.5 rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-medium text-warn">
              <span className="h-1.5 w-1.5 rounded-full bg-warn animate-pulse" />
              Live Process
            </span>
          )}
          {exec.outcome === "completed" && (
            <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[10px] font-medium text-ok">
              Process Finished (Exit {exec.exitCode ?? 0})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {failed && onExplainError && !running && (
            <button
              onClick={handleExplain}
              disabled={explaining}
              className="flex items-center gap-1 rounded bg-[#7c6dff]/20 border border-[#7c6dff]/40 px-2 py-0.5 text-[11px] font-medium text-[#a78bfa] hover:bg-[#7c6dff]/30 transition-colors"
            >
              {explaining ? (
                <>
                  <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-transparent border-t-[#a78bfa]" />
                  Thinking…
                </>
              ) : (
                <>✨ Explain with AI</>
              )}
            </button>
          )}

          {exec.chunks.length > 0 && (
            <button
              onClick={copyOutput}
              className="rounded px-2 py-0.5 text-[11px] text-dim hover:bg-raised hover:text-fg transition-colors"
              title="Copy output to clipboard"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          )}

          <button
            onClick={() => {
              onClear();
              setAiExplanation(null);
            }}
            className="rounded px-2 py-0.5 text-[11px] text-dim hover:bg-raised hover:text-fg transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* AI Error Explanation Box (if active) */}
      {aiExplanation && (
        <div className="border-b border-[#7c6dff]/30 bg-[#7c6dff]/10 p-3 text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-[#a78bfa] flex items-center gap-1.5">
              <span>🤖</span> AI Diagnostic & Fix
            </span>
            <button
              onClick={() => setAiExplanation(null)}
              className="text-dim hover:text-fg text-xs"
            >
              ✕
            </button>
          </div>
          <p className="text-fg text-xs leading-relaxed">{aiExplanation.explanation}</p>
          {aiExplanation.fix && (
            <div className="mt-2 rounded bg-black/40 p-2 font-mono text-[11px] text-[#a8d8a8] overflow-x-auto border border-white/5">
              <div className="flex items-center justify-between mb-1 text-[10px] text-dim">
                <span>Recommended Fix:</span>
                {applyFix && (
                  <button
                    onClick={() => applyFix(aiExplanation.fix!)}
                    className="rounded bg-accent/20 border border-accent/40 px-2 py-0.5 text-accent hover:bg-accent/30 font-semibold transition-colors"
                  >
                    ⚡ Apply Fix to Editor
                  </button>
                )}
              </div>
              <pre className="whitespace-pre-wrap">{aiExplanation.fix}</pre>
            </div>
          )}
        </div>
      )}

      {/* Terminal Stream View */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-[12.5px] leading-relaxed selection:bg-accent/30"
      >
        {exec.chunks.length === 0 && (
          <div className="flex flex-col items-start gap-1 text-dim/60 select-none py-2">
            <p>Ready to run code in secure isolated sandbox.</p>
            <p className="text-[11px]">Click <span className="text-accent font-semibold">Run</span> or press the status bar button to compile and execute.</p>
          </div>
        )}

        {exec.chunks.map((c, i) => (
          <span key={i} className={`whitespace-pre-wrap break-words ${color[c.kind]}`}>
            {c.text}
          </span>
        ))}

        {exec.outcome === "timeout" && (
          <div className="mt-2 rounded border border-bad/40 bg-bad/10 p-2 text-xs text-bad">
            TIMEOUT - Sandbox execution exceeded runtime limits. Resources released.
          </div>
        )}
      </div>

      {/* Program Stdin Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!running) return;
          onStdin(stdin + "\n");
          setStdin("");
        }}
        className="flex items-center gap-2 border-t border-line/80 bg-[#0d0f15] px-3 py-1.5"
      >
        <span className="font-mono text-xs font-semibold text-accent">$</span>
        <input
          value={stdin}
          onChange={(e) => setStdin(e.target.value)}
          disabled={!running}
          placeholder={running ? "Type input for running program and press Enter…" : "Program input disabled (run code to interact)"}
          aria-label="Program stdin"
          className="min-w-0 flex-1 bg-transparent font-mono text-xs text-fg placeholder:text-dim/50 focus:outline-none disabled:opacity-50"
        />
        {running && (
          <button
            type="submit"
            className="rounded bg-accent/20 border border-accent/40 px-2 py-0.5 text-[10px] font-semibold text-accent hover:bg-accent/30"
          >
            Send Stdin
          </button>
        )}
      </form>
    </section>
  );
}

