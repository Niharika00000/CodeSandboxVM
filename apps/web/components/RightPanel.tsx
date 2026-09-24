"use client";
import type { ChatEntry, UserInfo } from "@sandbox/shared";
import type { ExecState, AiChatMessageItem, SnapshotItem } from "@/hooks/useRoom";
import Chat from "./Chat";
import SandboxPanel from "./SandboxPanel";
import AiReviewPanel, { type ReviewResult } from "./AiReviewPanel";
import AiChatPanel from "./AiChatPanel";

export type RightTab = "chat" | "copilot" | "sandbox" | "review" | "snapshots";

interface Props {
  open: boolean;
  activeTab: RightTab;
  onTabChange: (tab: RightTab) => void;
  onClose: () => void;
  // Chat props
  users: UserInfo[];
  me: UserInfo | null;
  chat: ChatEntry[];
  unreadChat: number;
  onSendChat: (text: string) => void;
  // Sandbox props
  exec: ExecState;
  // Review props
  reviewLoading: boolean;
  reviewResult: ReviewResult | null;
  reviewError: string | null;
  activeFileName?: string;
  onTriggerReview: () => void;
  // AI Copilot props
  aiChatMessages: AiChatMessageItem[];
  aiChatLoading: boolean;
  onSendAiChat: (prompt: string) => void;
  onClearAiChat: () => void;
  onApplyCode: (code: string) => void;
  // Snapshots props
  snapshots: SnapshotItem[];
  onSaveSnapshot: (name: string) => void;
  onRestoreSnapshot: (id: string) => void;
  onDeleteSnapshot: (id: string) => void;
}

export default function RightPanel({
  open,
  activeTab,
  onTabChange,
  onClose,
  users,
  me,
  chat,
  unreadChat,
  onSendChat,
  exec,
  reviewLoading,
  reviewResult,
  reviewError,
  activeFileName = "active file",
  onTriggerReview,
  aiChatMessages,
  aiChatLoading,
  onSendAiChat,
  onClearAiChat,
  onApplyCode,
  snapshots,
  onSaveSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
}: Props) {
  if (!open) return null;

  const isRunning = exec.outcome === "running";
  const hasReviewScore = reviewResult !== null;

  return (
    <aside
      className="flex w-80 md:w-[420px] shrink-0 flex-col border-l border-line bg-panel shadow-2xl transition-all duration-200 z-10"
      aria-label="Workspace sidebar"
    >
      {/* Right panel navigation tabs */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-line bg-[#12151c] px-2">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
          {/* Chat Tab */}
          <button
            onClick={() => onTabChange("chat")}
            className={`relative flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all ${
              activeTab === "chat"
                ? "bg-raised text-accent shadow-sm"
                : "text-dim hover:bg-raised/50 hover:text-fg"
            }`}
            title="Room Chat & Online Users"
          >
            <span className="text-xs">💬</span>
            <span>Chat</span>
            {unreadChat > 0 && activeTab !== "chat" && (
              <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-bad px-1 text-[9px] font-bold text-white shadow-sm animate-pulse">
                {unreadChat > 9 ? "9+" : unreadChat}
              </span>
            )}
          </button>

          {/* AI Copilot Tab */}
          <button
            onClick={() => onTabChange("copilot")}
            className={`relative flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all ${
              activeTab === "copilot"
                ? "bg-raised text-accent shadow-sm border border-accent/30"
                : "text-dim hover:bg-raised/50 hover:text-fg"
            }`}
            title="Interactive AI Copilot & Code Patching"
          >
            <span className="text-xs">🤖</span>
            <span>Copilot</span>
            {aiChatLoading && (
              <span className="inline-block h-2 w-2 animate-spin rounded-full border border-transparent border-t-accent" />
            )}
          </button>

          {/* Sandbox / Compiler Tab */}
          <button
            onClick={() => onTabChange("sandbox")}
            className={`relative flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all ${
              activeTab === "sandbox"
                ? "bg-raised text-accent shadow-sm"
                : "text-dim hover:bg-raised/50 hover:text-fg"
            }`}
            title="Sandbox & Compiler Status"
          >
            <span className="text-xs">⚡</span>
            <span>Compiler</span>
            {isRunning && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warn opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-warn" />
              </span>
            )}
          </button>

          {/* AI Review Tab */}
          <button
            onClick={() => onTabChange("review")}
            className={`relative flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all ${
              activeTab === "review"
                ? "bg-raised text-[#a78bfa] shadow-sm border border-[#7c6dff]/30"
                : "text-dim hover:bg-raised/50 hover:text-fg"
            }`}
            title="AI Code Review & Quality Analysis"
          >
            <span className="text-xs">🔍</span>
            <span>Review</span>
            {reviewLoading && (
              <span className="inline-block h-2 w-2 animate-spin rounded-full border border-transparent border-t-[#a78bfa]" />
            )}
            {hasReviewScore && !reviewLoading && (
              <span
                className={`rounded px-1 text-[9px] font-bold ${
                  reviewResult.score >= 8
                    ? "bg-ok/20 text-ok"
                    : reviewResult.score >= 5
                    ? "bg-warn/20 text-warn"
                    : "bg-bad/20 text-bad"
                }`}
              >
                {reviewResult.score.toFixed(1)}
              </span>
            )}
          </button>

          {/* Snapshots Tab */}
          <button
            onClick={() => onTabChange("snapshots")}
            className={`relative flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all ${
              activeTab === "snapshots"
                ? "bg-raised text-accent shadow-sm"
                : "text-dim hover:bg-raised/50 hover:text-fg"
            }`}
            title="Code Snapshots & Version Checkpoints"
          >
            <span className="text-xs">📸</span>
            <span>History ({snapshots.length})</span>
          </button>
        </div>

        {/* Close/minimize panel button */}
        <button
          onClick={onClose}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          className="flex h-7 w-7 items-center justify-center rounded-md text-dim hover:bg-raised hover:text-fg transition-colors shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Panel Body */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === "chat" && (
          <Chat
            open={true}
            users={users}
            me={me}
            chat={chat}
            onSend={onSendChat}
            onClose={onClose}
            embedded={true}
          />
        )}

        {activeTab === "copilot" && (
          <AiChatPanel
            messages={aiChatMessages}
            loading={aiChatLoading}
            onSendMessage={onSendAiChat}
            onApplyCode={onApplyCode}
            onClear={onClearAiChat}
            activeFileName={activeFileName}
          />
        )}

        {activeTab === "sandbox" && (
          <SandboxPanel exec={exec} embedded={true} />
        )}

        {activeTab === "review" && (
          <AiReviewPanel
            open={true}
            loading={reviewLoading}
            result={reviewResult}
            error={reviewError}
            filename={activeFileName}
            onClose={onClose}
            onRefresh={onTriggerReview}
            onApplyCode={onApplyCode}
            embedded={true}
          />
        )}

        {activeTab === "snapshots" && (
          <div className="flex h-full min-h-0 flex-1 flex-col bg-panel p-3 overflow-y-auto space-y-3">
            <div className="rounded-lg border border-line bg-raised/20 p-3">
              <h3 className="text-xs font-semibold text-fg">Code Snapshots</h3>
              <p className="text-[11px] text-dim mt-0.5">Capture instant checkpoints of all room files to revert anytime.</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const target = e.currentTarget.elements.namedItem("snapName") as HTMLInputElement;
                  if (target?.value.trim()) {
                    onSaveSnapshot(target.value.trim());
                    target.value = "";
                  }
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  name="snapName"
                  placeholder="Snapshot name…"
                  className="min-w-0 flex-1 rounded border border-line bg-[#0a0c10] px-2.5 py-1 text-xs text-fg placeholder:text-dim/60 outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  className="rounded bg-accent px-3 py-1 text-xs font-semibold text-bg hover:brightness-110"
                >
                  Save
                </button>
              </form>
            </div>

            <div className="space-y-2">
              {snapshots.length === 0 && (
                <p className="py-6 text-center text-xs text-dim">No snapshots recorded yet.</p>
              )}
              {snapshots.map((s) => (
                <div key={s.id} className="rounded-lg border border-line bg-[#10131a] p-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-fg">{s.name}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onRestoreSnapshot(s.id)}
                        className="rounded border border-line bg-raised px-2 py-0.5 text-[10px] text-accent hover:border-accent font-medium"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => onDeleteSnapshot(s.id)}
                        className="p-1 text-dim hover:text-bad text-[10px]"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-dim">
                    <span>By {s.author}</span>
                    <span>·</span>
                    <span>{new Date(s.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                    <span>·</span>
                    <span>{s.files.length} file(s)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

