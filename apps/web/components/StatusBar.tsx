"use client";
import type { ExecState } from "@/hooks/useRoom";
import type { FileMeta } from "@sandbox/shared";
import { LANGUAGE_REGISTRY, SUPPORTED_LANGUAGES, getLanguageLabel } from "@/lib/language";

export default function StatusBar({
  exec,
  ready,
  onRun,
  onStop,
  onReview,
  reviewLoading,
  aiEnabled,
  onToggleAi,
  aiAvailable,
  activeFile,
  onSetLanguage,
}: {
  exec: ExecState;
  ready: boolean;
  onRun: () => void;
  onStop: () => void;
  onReview: () => void;
  reviewLoading: boolean;
  aiEnabled: boolean;
  onToggleAi: () => void;
  aiAvailable: boolean;
  activeFile?: FileMeta;
  onSetLanguage?: (lang: string) => void;
}) {
  const running = exec.outcome === "running";
  const label = !exec.outcome ? "Idle" : running ? "Running" : exec.outcome === "completed" ? "Completed" : exec.outcome === "timeout" ? "Timeout" : "Failed";
  const tone = !exec.outcome ? "text-dim" : running ? "text-warn" : exec.outcome === "completed" ? "text-ok" : "text-bad";

  return (
    <footer className="flex h-10 shrink-0 items-center gap-4 border-t border-line bg-[#12151c]/95 backdrop-blur px-3 text-xs text-dim z-20">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px]">Status:</span>
        <span className={`flex items-center gap-1 font-semibold ${tone}`}>
          {running && <span className="h-1.5 w-1.5 rounded-full bg-warn animate-ping" />}
          {label}
        </span>
      </div>

      <div className="h-3 w-px bg-line/60" />

      <div className="flex items-center gap-1.5">
        <span className="text-[11px]">Language:</span>
        {onSetLanguage ? (
          <select
            value={activeFile?.language || "javascript"}
            onChange={(e) => onSetLanguage(e.target.value)}
            aria-label="Select file language"
            className="rounded border border-line/70 bg-raised px-2 py-0.5 text-xs font-mono font-medium text-fg outline-none hover:border-accent focus:border-accent transition-colors cursor-pointer"
          >
            <optgroup label="Executable Runtimes">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {LANGUAGE_REGISTRY[lang].name} ({LANGUAGE_REGISTRY[lang].runtimeLabel})
                </option>
              ))}
            </optgroup>
            <optgroup label="Other">
              <option value="json">JSON</option>
              <option value="markdown">Markdown</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
              <option value="yaml">YAML</option>
              <option value="plaintext">Plain Text</option>
            </optgroup>
          </select>
        ) : (
          <b className="font-medium text-fg font-mono">{getLanguageLabel(activeFile?.language)}</b>
        )}
      </div>

      <div className="hidden md:flex items-center gap-4 text-[11px]">
        <span>CPU: <b className="font-mono text-fg">{exec.limits ? `${exec.limits.cpus} core` : "0.5 core"}</b></span>
        <span>Time: <b className="font-mono text-fg">{exec.durationMs !== undefined ? `${(exec.durationMs / 1000).toFixed(2)}s` : "-"}</b></span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onToggleAi}
          title={aiAvailable ? "Toggle AI ghost text completions (NVIDIA NIM)" : "Set NVIDIA_API_KEY on the server to enable"}
          className={`flex items-center gap-1.5 rounded border border-line/80 px-2.5 py-1 text-xs transition-colors ${
            aiEnabled ? "bg-accent/15 border-accent/40 text-accent font-medium" : "text-dim hover:bg-raised hover:text-fg"
          }`}
        >
          <span className="text-xs">✨</span>
          <span>AI Assist: {aiEnabled ? "On" : "Off"}</span>
        </button>

        <button
          id="ai-review-btn"
          onClick={onReview}
          disabled={reviewLoading || !activeFile}
          title="Analyze current file with AI Code Review"
          className="flex items-center gap-1.5 rounded border border-[#7c6dff]/50 bg-[#7c6dff]/15 px-2.5 py-1 text-xs font-medium text-[#a78bfa] hover:bg-[#7c6dff]/25 disabled:opacity-40 disabled:hover:bg-[#7c6dff]/15 transition-all shadow-sm"
        >
          {reviewLoading ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-transparent border-t-[#a78bfa]" />
              Reviewing…
            </>
          ) : (
            <>🔍 Review</>
          )}
        </button>

        {running ? (
          <button
            onClick={onStop}
            className="flex items-center gap-1 rounded border border-bad/50 bg-bad/15 px-3 py-1 text-xs font-semibold text-bad hover:bg-bad/25 transition-all"
          >
            ■ Stop
          </button>
        ) : (
          <button
            onClick={onRun}
            disabled={!ready}
            title={!ready ? "Connect and select a runnable code file to execute" : "Execute in secure sandbox container"}
            className="flex items-center gap-1.5 rounded bg-gradient-to-r from-accent to-[#5a95f5] px-4 py-1 text-xs font-semibold text-bg hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100 transition-all shadow-md shadow-accent/20"
          >
            <span>▶</span>
            <span>Run</span>
          </button>
        )}
      </div>
    </footer>
  );
}
