"use client";
import { useState, useRef, useEffect } from "react";
import type { AiChatMessageItem } from "@/hooks/useRoom";

interface Props {
  messages: AiChatMessageItem[];
  loading: boolean;
  onSendMessage: (msg: string) => void;
  onApplyCode: (code: string) => void;
  onClear: () => void;
  activeFileName?: string;
}

const QUICK_PROMPTS = [
  "⚡ Optimize this code",
  "🧪 Generate unit tests",
  "🔍 Find potential bugs",
  "📖 Add comments & documentation",
];

export default function AiChatPanel({
  messages,
  loading,
  onSendMessage,
  onApplyCode,
  onClear,
  activeFileName = "active file",
}: Props) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleApply = (id: string, code: string) => {
    onApplyCode(code);
    setAppliedId(id);
    setTimeout(() => setAppliedId(null), 2000);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-panel" aria-label="AI Copilot panel">
      {/* Subheader */}
      <div className="flex items-center justify-between border-b border-line bg-raised/20 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🤖</span>
          <span className="font-semibold text-fg">AI Assistant</span>
          <span className="text-[10px] text-dim truncate max-w-[120px]">({activeFileName})</span>
        </div>
        <button
          onClick={onClear}
          title="Clear AI conversation"
          className="text-[10px] text-dim hover:text-fg transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Messages stream */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div key={m.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
              <div className="mb-1 flex items-center gap-1.5 text-[10px] text-dim">
                <span>{isUser ? "You" : "AI Copilot"}</span>
                <span>·</span>
                <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              </div>
              <div
                className={`rounded-xl px-3 py-2 text-[12.5px] leading-relaxed max-w-[92%] break-words ${
                  isUser
                    ? "bg-accent text-bg font-medium"
                    : "bg-[#10131a] border border-line text-fg"
                }`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>
                {m.suggestedCode && (
                  <div className="mt-2.5 rounded-lg border border-line/80 bg-[#0a0c10] overflow-hidden">
                    <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-2.5 py-1 text-[10px] text-dim">
                      <span>Suggested Code</span>
                      <button
                        onClick={() => handleApply(m.id, m.suggestedCode!)}
                        className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition-all ${
                          appliedId === m.id
                            ? "bg-ok text-bg"
                            : "bg-accent/20 border border-accent/40 text-accent hover:bg-accent/30"
                        }`}
                      >
                        {appliedId === m.id ? "✓ Applied to Editor" : "⚡ Apply to Code"}
                      </button>
                    </div>
                    <pre className="p-2.5 font-mono text-[11px] text-[#a8d8a8] overflow-x-auto">
                      <code>{m.suggestedCode}</code>
                    </pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 rounded-xl bg-[#10131a] border border-line p-3 text-xs text-dim">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-transparent border-t-[#a78bfa]" />
            <span>AI Copilot is analyzing your code and drafting response…</span>
          </div>
        )}
      </div>

      {/* Quick Prompts */}
      <div className="border-t border-line/60 bg-[#0e1017] p-2 overflow-x-auto flex gap-1.5 scrollbar-none">
        {QUICK_PROMPTS.map((qp) => (
          <button
            key={qp}
            onClick={() => onSendMessage(qp)}
            disabled={loading}
            className="shrink-0 rounded-full border border-line/80 bg-panel px-2.5 py-1 text-[10.5px] text-dim hover:border-accent hover:text-fg disabled:opacity-40 transition-colors"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Prompt input form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim() && !loading) {
            onSendMessage(draft);
            setDraft("");
          }
        }}
        className="border-t border-line bg-raised/10 p-2.5 flex items-center gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Ask AI about ${activeFileName}…`}
          disabled={loading}
          className="min-w-0 flex-1 rounded-md border border-line bg-[#0d0f14] px-3 py-1.5 text-xs text-fg placeholder:text-dim/60 outline-none focus:border-accent transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!draft.trim() || loading}
          className="rounded-md bg-gradient-to-r from-accent to-[#7c6dff] px-3 py-1.5 text-xs font-semibold text-bg hover:brightness-110 disabled:opacity-40 transition-all flex items-center gap-1 shadow-sm"
        >
          Send
        </button>
      </form>
    </div>
  );
}

