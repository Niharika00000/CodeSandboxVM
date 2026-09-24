"use client";
import { useState } from "react";
import type { UserInfo } from "@sandbox/shared";
import type { ConnState } from "@/hooks/useRoom";
import type { RightTab } from "./RightPanel";

const CONN: Record<ConnState, { label: string; dot: string }> = {
  connecting: { label: "Connecting", dot: "bg-warn" },
  connected: { label: "Connected", dot: "bg-ok shadow-sm shadow-ok/50" },
  reconnecting: { label: "Reconnecting", dot: "bg-warn animate-pulse" },
  closed: { label: "Disconnected", dot: "bg-bad" },
};

interface Props {
  roomId: string;
  users: UserInfo[];
  me: UserInfo | null;
  conn: ConnState;
  unreadChat: number;
  rightPanelOpen: boolean;
  activeRightTab: RightTab;
  onSelectRightTab: (tab: RightTab) => void;
  filesOpen: boolean;
  onToggleFiles: () => void;
  isRunning?: boolean;
  isPresenter?: boolean;
  isReadOnly?: boolean;
  onTogglePresenter?: () => void;
}

export default function TopBar({
  roomId,
  users,
  me,
  conn,
  unreadChat,
  rightPanelOpen,
  activeRightTab,
  onSelectRightTab,
  filesOpen,
  onToggleFiles,
  isRunning = false,
  isPresenter = false,
  isReadOnly = false,
  onTogglePresenter,
}: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-line bg-[#12151c]/95 backdrop-blur px-3 text-sm z-20">
      {/* Left side: Brand, File Toggle, Room Info */}
      <div className="flex items-center gap-3">
        <a href="/" className="flex items-center gap-2 group">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-accent to-[#7c6dff] text-xs font-bold text-bg shadow-sm shadow-accent/20 group-hover:scale-105 transition-transform">
            ⚡
          </span>
          <span className="font-semibold tracking-tight text-fg">
            Sandbox<span className="text-accent">Room</span>
          </span>
        </a>

        {/* Toggle Files button */}
        <button
          onClick={onToggleFiles}
          title={filesOpen ? "Collapse files explorer" : "Expand files explorer"}
          aria-label="Toggle file explorer"
          className={`flex items-center gap-1.5 rounded border border-line/70 px-2 py-1 text-xs transition-colors ${
            filesOpen ? "bg-raised text-fg" : "text-dim hover:bg-raised hover:text-fg"
          }`}
        >
          <span>📁</span>
          <span className="hidden sm:inline">Files</span>
        </button>

        <div className="h-4 w-px bg-line/60" />

        {/* Room tag & copy */}
        <div className="flex items-center gap-1.5 text-xs text-dim">
          <span className="hidden md:inline">Room:</span>
          <code className="rounded bg-raised border border-line/60 px-2 py-0.5 font-mono text-[11px] text-fg">
            {roomId}
          </code>
          <button
            onClick={copy}
            title="Copy invitation link"
            className="flex items-center gap-1 rounded border border-line/60 bg-panel px-2 py-0.5 text-xs text-fg hover:bg-raised transition-colors"
          >
            {copied ? (
              <span className="text-ok font-medium">✓ Copied</span>
            ) : (
              <span>🔗 Copy</span>
            )}
          </button>
        </div>

        {/* Presenter Mode Badge */}
        {isReadOnly && (
          <span className="rounded-full bg-[#ffaa00]/15 border border-[#ffaa00]/30 px-2 py-0.5 text-[10px] font-semibold text-[#ffaa00] flex items-center gap-1">
            <span>👁️</span> Read-Only (Presenter Active)
          </span>
        )}
      </div>

      {/* Right side: Users, Connection, Workspace Panel Tabs */}
      <div className="flex items-center gap-2.5">
        {/* User Avatars */}
        <div className="flex items-center gap-1.5">
          <ul className="flex items-center -space-x-1.5" aria-label="Connected users">
            {users.slice(0, 5).map((u) => (
              <li
                key={u.id}
                title={u.id === me?.id ? `${u.name} (you)` : u.name}
                className={`user-${u.colorIndex} flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#12151c] text-[10px] font-bold text-bg shadow-sm`}
              >
                {u.name.slice(0, 1).toUpperCase()}
              </li>
            ))}
            {users.length > 5 && (
              <li className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#12151c] bg-raised text-[10px] font-semibold text-dim">
                +{users.length - 5}
              </li>
            )}
          </ul>
          <span className="hidden lg:inline text-xs text-dim">{users.length} online</span>
        </div>

        {/* Connection status */}
        <span className="hidden sm:flex items-center gap-1.5 text-xs text-dim" role="status">
          <span className={`h-2 w-2 rounded-full ${CONN[conn].dot}`} />
          <span>{CONN[conn].label}</span>
        </span>

        {/* Presenter Toggle */}
        {onTogglePresenter && (
          <button
            onClick={onTogglePresenter}
            title={isPresenter ? "Stop Presenting" : "Present Screen (sets read-only for others)"}
            className={`flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors ${
              isPresenter
                ? "bg-accent/20 border-accent text-accent font-semibold"
                : "border-line text-dim hover:text-fg hover:bg-raised"
            }`}
          >
            <span>{isPresenter ? "🎙️ Presenting" : "🎙️ Present"}</span>
          </button>
        )}

        <div className="h-4 w-px bg-line/60" />

        {/* Workspace Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Chat Tab Button */}
          <button
            onClick={() => onSelectRightTab("chat")}
            aria-label="Toggle chat"
            className={`relative flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors ${
              rightPanelOpen && activeRightTab === "chat"
                ? "border-accent/40 bg-accent/15 text-accent font-medium"
                : "border-line text-dim hover:bg-raised hover:text-fg"
            }`}
          >
            <span>💬</span>
            <span className="hidden md:inline">Chat</span>
            {unreadChat > 0 && !(rightPanelOpen && activeRightTab === "chat") && (
              <span className="chat-badge flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[9px] font-bold text-white">
                {unreadChat > 9 ? "9+" : unreadChat}
              </span>
            )}
          </button>

          {/* AI Copilot Button */}
          <button
            onClick={() => onSelectRightTab("copilot")}
            aria-label="Toggle AI copilot"
            className={`relative flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors ${
              rightPanelOpen && activeRightTab === "copilot"
                ? "border-accent/40 bg-accent/15 text-accent font-medium"
                : "border-line text-dim hover:bg-raised hover:text-fg"
            }`}
          >
            <span>🤖</span>
            <span className="hidden md:inline">Copilot</span>
          </button>

          {/* Compiler Tab Button */}
          <button
            onClick={() => onSelectRightTab("sandbox")}
            aria-label="Toggle compiler status"
            className={`relative flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors ${
              rightPanelOpen && activeRightTab === "sandbox"
                ? "border-accent/40 bg-accent/15 text-accent font-medium"
                : "border-line text-dim hover:bg-raised hover:text-fg"
            }`}
          >
            <span>⚡</span>
            <span className="hidden md:inline">Compiler</span>
            {isRunning && (
              <span className="h-1.5 w-1.5 rounded-full bg-warn animate-ping" />
            )}
          </button>

          {/* AI Review Tab Button */}
          <button
            onClick={() => onSelectRightTab("review")}
            aria-label="Toggle AI review"
            className={`relative flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors ${
              rightPanelOpen && activeRightTab === "review"
                ? "border-[#7c6dff]/50 bg-[#7c6dff]/20 text-[#a78bfa] font-medium"
                : "border-line text-dim hover:bg-raised hover:text-fg"
            }`}
          >
            <span>🔍</span>
            <span className="hidden md:inline">Review</span>
          </button>
        </div>
      </div>
    </header>
  );
}

