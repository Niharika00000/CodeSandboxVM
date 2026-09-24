"use client";
import { useEffect, useRef, useState } from "react";
import type { ChatEntry, UserInfo } from "@sandbox/shared";

function timeLabel(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

interface Props {
  open: boolean;
  users: UserInfo[];
  me: UserInfo | null;
  chat: ChatEntry[];
  onSend: (text: string) => void;
  onClose: () => void;
  embedded?: boolean;
}

export default function Chat({
  open,
  users,
  me,
  chat,
  onSend,
  onClose,
  embedded = false,
}: Props) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Safely scroll internal chat container without moving the page window
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat, open]);

  if (!open) return null;

  const content = (
    <>
      {/* Online Users Summary */}
      <div className="border-b border-line bg-raised/20 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ok animate-pulse" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-dim">
              Online ({users.length})
            </h2>
          </div>
          {!embedded && (
            <button
              onClick={onClose}
              aria-label="Close chat"
              className="rounded p-1 text-dim hover:bg-raised hover:text-fg transition-colors"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {users.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-line/60 bg-panel px-2 py-0.5 text-[11px] text-fg"
            >
              <span
                className={`user-${u.colorIndex} flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold text-bg`}
              >
                {u.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="truncate max-w-[100px]">{u.name}{u.id === me?.id ? " (you)" : ""}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3 text-sm space-y-3">
        {chat.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center text-dim">
            <span className="text-2xl mb-1">💬</span>
            <p className="text-xs font-medium text-fg">No messages yet</p>
            <p className="text-[11px] text-dim mt-0.5">Send a message to collaborate in real-time</p>
          </div>
        )}
        {chat.map((c) => {
          const isMe = c.userId === me?.id;
          return (
            <div key={c.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              <div className="mb-1 flex items-center gap-1.5 text-[10px] text-dim">
                <span className={`user-${c.colorIndex} h-1.5 w-1.5 rounded-full`} />
                <span className="font-medium text-fg/80">{isMe ? "You" : c.name}</span>
                <span>·</span>
                <span>{timeLabel(c.ts)}</span>
              </div>
              <div
                className={`inline-block max-w-[88%] rounded-xl px-3 py-2 text-[13px] leading-relaxed shadow-sm break-words ${
                  isMe
                    ? "bg-gradient-to-r from-accent to-[#5a95f5] text-bg font-medium"
                    : "bg-raised border border-line text-fg"
                }`}
              >
                {c.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chat Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) {
            onSend(draft);
            setDraft("");
          }
        }}
        className="border-t border-line bg-raised/10 p-2.5 flex items-center gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message room…"
          maxLength={2000}
          aria-label="Chat message"
          className="min-w-0 flex-1 rounded-md border border-line bg-[#0d0f14] px-3 py-1.5 text-xs text-fg placeholder:text-dim/60 outline-none focus:border-accent transition-colors"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-bg hover:brightness-110 disabled:opacity-40 transition-all flex items-center gap-1"
        >
          Send
        </button>
      </form>
    </>
  );

  if (embedded) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col bg-panel" aria-label="Chat panel">
        {content}
      </div>
    );
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-line bg-panel" aria-label="Chat">
      {content}
    </aside>
  );
}

