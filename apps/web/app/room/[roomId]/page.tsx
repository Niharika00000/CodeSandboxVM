"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useRoom } from "@/hooks/useRoom";
import CodeEditor from "@/components/CodeEditor";
import Terminal from "@/components/Terminal";
import RightPanel, { type RightTab } from "@/components/RightPanel";
import TopBar from "@/components/TopBar";
import StatusBar from "@/components/StatusBar";
import FileExplorer from "@/components/FileExplorer";
import FileTabs from "@/components/FileTabs";
import TestRunner from "@/components/TestRunner";
import WebPreview from "@/components/WebPreview";
import SnapshotsModal from "@/components/SnapshotsModal";
import { isRunnableLanguage } from "@/lib/language";

type BottomTab = "terminal" | "tests" | "preview";

function NamePrompt({ onDone }: { onDone: (n: string) => void }) {
  const [v, setV] = useState("");
  return (
    <main className="flex min-h-screen items-center justify-center px-6 bg-[#0c0d12]">
      <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) onDone(v.trim().slice(0, 24)); }} className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-panel p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">⚡</span>
          <h1 className="text-base font-semibold text-fg">Join this collaborative room</h1>
        </div>
        <p className="text-xs text-dim">Enter your display name to start coding with your peers in real-time.</p>
        <input
          autoFocus
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="e.g. Alice, Bob, Developer"
          maxLength={24}
          aria-label="Display name"
          className="w-full rounded-md border border-line bg-[#0d0f14] px-3 py-2 text-sm text-fg outline-none focus:border-accent transition-colors"
        />
        <button
          type="submit"
          disabled={!v.trim()}
          className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg hover:brightness-110 disabled:opacity-40 transition-all shadow-md shadow-accent/20"
        >
          Join Room
        </button>
      </form>
    </main>
  );
}

function Room({ roomId, name }: { roomId: string; name: string }) {
  const r = useRoom(roomId, name);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>("chat");
  const [filesOpen, setFilesOpen] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [bottomTab, setBottomTab] = useState<BottomTab>("terminal");
  const [bottomHeight, setBottomHeight] = useState(250);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [snapshotsModalOpen, setSnapshotsModalOpen] = useState(false);

  // Automatically clear unread chat when the chat tab is actively open
  useEffect(() => {
    if (rightPanelOpen && rightTab === "chat") {
      r.clearUnreadChat();
    }
  }, [rightPanelOpen, rightTab, r.chat.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resizable vertical splitter between Monaco editor and bottom panel
  const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = bottomHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      const newHeight = Math.max(120, Math.min(window.innerHeight - 180, startH + delta));
      setBottomHeight(newHeight);
      setBottomCollapsed(false);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [bottomHeight]);

  if (r.fatal) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0c0d12]">
        <div className="rounded-xl border border-bad/40 bg-bad/10 p-6 text-center max-w-md shadow-2xl">
          <span className="text-3xl block mb-2">⚠️</span>
          <p role="alert" className="text-sm font-medium text-bad">{r.fatal}</p>
          <a href="/" className="mt-4 inline-block text-xs text-accent underline hover:brightness-125">
            Back to homepage
          </a>
        </div>
      </main>
    );
  }

  const canRun = r.conn === "connected" && r.synced && isRunnableLanguage(r.activeFile?.language);

  const handleSelectRightTab = (tab: RightTab) => {
    if (rightPanelOpen && rightTab === tab) {
      setRightPanelOpen(false);
    } else {
      setRightTab(tab);
      setRightPanelOpen(true);
    }
  };

  const handleTriggerReview = () => {
    setRightTab("review");
    setRightPanelOpen(true);
    r.reviewCode(r.activeFileId);
  };

  return (
    <div className="flex h-screen flex-col bg-[#0c0d12] overflow-hidden select-none">
      <TopBar
        roomId={roomId}
        users={r.users}
        me={r.me}
        conn={r.conn}
        unreadChat={r.unreadChat}
        rightPanelOpen={rightPanelOpen}
        activeRightTab={rightTab}
        onSelectRightTab={handleSelectRightTab}
        filesOpen={filesOpen}
        onToggleFiles={() => setFilesOpen((v) => !v)}
        isRunning={r.exec.outcome === "running"}
        isPresenter={r.isPresenter}
        isReadOnly={r.isReadOnly}
        onTogglePresenter={r.togglePresenter}
      />

      {r.error && (
        <div role="alert" className="flex items-center justify-between border-b border-bad/30 bg-bad/15 px-3 py-1.5 text-xs text-bad">
          <div className="flex items-center gap-1.5">
            <span>⚠️</span>
            <span>{r.error}</span>
          </div>
          <button onClick={r.clearError} className="text-xs underline hover:brightness-125">Dismiss</button>
        </div>
      )}

      {/* Main Workspace Body: Files Explorer + (Editor + Bottom Panel) + Unified Right Panel */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <FileExplorer
          files={r.files}
          activeFileId={r.activeFileId}
          onOpen={r.openFile}
          open={filesOpen}
          onNewFile={() => {
            const n = window.prompt("New file name (e.g. main.py, app.cpp, main.go, index.ts, main.rs, Main.java, utils.js)");
            if (n && n.trim()) r.createFile(n.trim());
          }}
          onImportFiles={r.importFiles}
          onImportFolder={r.importFolder}
          onRenameFile={r.renameFile}
          onDeleteFile={r.deleteFile}
          onDuplicateFile={r.duplicateFile}
          onExportZip={r.exportAllFilesZip}
        />

        {/* Center: Tabs + Monaco Editor + Resizable Bottom Split Panel */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Top: Editor Tabs + Editor */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <FileTabs
              files={r.files}
              openTabs={r.openTabs}
              activeFileId={r.activeFileId}
              onSelect={r.openFile}
              onClose={r.closeTab}
            />
            <div className="min-h-0 flex-1 overflow-hidden relative">
              {r.isReadOnly && (
                <div className="absolute top-2 right-4 z-20 flex items-center gap-2 rounded-full border border-warn/40 bg-[#161307]/90 px-3 py-1 text-xs text-warn shadow-lg backdrop-blur-sm">
                  <span className="inline-block h-2 w-2 rounded-full bg-warn animate-pulse" />
                  <span><strong>{r.presenterName}</strong> is presenting — read-only mode</span>
                </div>
              )}
              {r.synced && r.activeFile ? (
                <CodeEditor
                  doc={r.doc}
                  file={r.activeFile}
                  me={r.me}
                  users={r.users}
                  onCursor={r.sendCursor}
                  onMultiCursor={r.sendMultiCursor}
                  aiEnabled={aiEnabled}
                  fetchSuggestion={r.fetchAiSuggestion}
                  readOnly={r.isReadOnly}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-dim">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-accent" />
                    <span>Syncing document...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Draggable Splitter Bar */}
          <div
            onMouseDown={handleSplitterMouseDown}
            className="group relative flex h-1.5 w-full cursor-row-resize items-center justify-center bg-line/60 hover:bg-accent/80 transition-colors select-none"
            title="Drag to resize bottom panel"
          >
            <div className="h-0.5 w-12 rounded-full bg-dim/60 group-hover:bg-fg transition-colors" />
          </div>

          {/* Bottom Panel Container */}
          <div
            style={{ height: bottomCollapsed ? 32 : bottomHeight }}
            className="flex flex-col border-t border-line bg-[#0c0d12] overflow-hidden"
          >
            {/* Bottom Bar Header with tabs */}
            <div className="flex h-8 shrink-0 items-center justify-between border-b border-line/60 bg-[#0d0f14] px-2 text-xs">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setBottomTab("terminal"); setBottomCollapsed(false); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors text-xs font-medium ${
                    bottomTab === "terminal" && !bottomCollapsed
                      ? "bg-[#181b24] text-fg border border-line/60 shadow-sm"
                      : "text-dim hover:text-fg hover:bg-[#141720]"
                  }`}
                >
                  <span>💻</span>
                  <span>Terminal</span>
                  {r.exec.outcome === "running" && (
                    <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                  )}
                </button>

                <button
                  onClick={() => { setBottomTab("tests"); setBottomCollapsed(false); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors text-xs font-medium ${
                    bottomTab === "tests" && !bottomCollapsed
                      ? "bg-[#181b24] text-fg border border-line/60 shadow-sm"
                      : "text-dim hover:text-fg hover:bg-[#141720]"
                  }`}
                >
                  <span>🧪</span>
                  <span>Test Cases</span>
                </button>

                <button
                  onClick={() => { setBottomTab("preview"); setBottomCollapsed(false); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors text-xs font-medium ${
                    bottomTab === "preview" && !bottomCollapsed
                      ? "bg-[#181b24] text-fg border border-line/60 shadow-sm"
                      : "text-dim hover:text-fg hover:bg-[#141720]"
                  }`}
                >
                  <span>🌐</span>
                  <span>Web Preview</span>
                  <span className="rounded bg-ok/20 px-1 py-0.2 text-[9px] text-ok">Live</span>
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setBottomCollapsed((v) => !v)}
                  title={bottomCollapsed ? "Expand panel" : "Collapse panel"}
                  className="rounded px-1.5 py-0.5 text-xs text-dim hover:text-fg hover:bg-line/40 transition-colors"
                >
                  {bottomCollapsed ? "▲ Expand" : "▼ Collapse"}
                </button>
              </div>
            </div>

            {/* Active Bottom Tab Content */}
            {!bottomCollapsed && (
              <div className="flex-1 min-h-0 overflow-hidden">
                {bottomTab === "terminal" && (
                  <Terminal
                    exec={r.exec}
                    onClear={r.clearTerminal}
                    onStdin={r.sendStdin}
                    onExplainError={(stderr) => r.explainError(stderr)}
                    onApplyCode={r.applyCodeToEditor}
                  />
                )}
                {bottomTab === "tests" && (
                  <TestRunner doc={r.doc} activeFile={r.activeFile} />
                )}
                {bottomTab === "preview" && (
                  <WebPreview doc={r.doc} files={r.files} activeFile={r.activeFile} />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Unified Right Sidebar: Chat, AI Copilot, Sandbox/Compiler, AI Review, History Snapshots */}
        <RightPanel
          open={rightPanelOpen}
          activeTab={rightTab}
          onTabChange={setRightTab}
          onClose={() => setRightPanelOpen(false)}
          users={r.users}
          me={r.me}
          chat={r.chat}
          unreadChat={r.unreadChat}
          onSendChat={r.sendChat}
          exec={r.exec}
          reviewLoading={r.reviewLoading}
          reviewResult={r.reviewResult}
          reviewError={r.reviewError}
          activeFileName={r.activeFile?.name}
          onTriggerReview={handleTriggerReview}
          aiChatMessages={r.aiChatMessages}
          aiChatLoading={r.aiChatLoading}
          onSendAiChat={r.sendAiChat}
          onClearAiChat={r.clearAiChat}
          onApplyCode={r.applyCodeToEditor}
          snapshots={r.snapshots}
          onSaveSnapshot={r.saveSnapshot}
          onRestoreSnapshot={r.restoreSnapshot}
          onDeleteSnapshot={r.deleteSnapshot}
        />
      </div>

      <StatusBar
        exec={r.exec}
        ready={canRun}
        onRun={r.run}
        onStop={r.stop}
        onReview={handleTriggerReview}
        reviewLoading={r.reviewLoading}
        aiEnabled={aiEnabled}
        onToggleAi={() => setAiEnabled((v) => !v)}
        aiAvailable={true}
        activeFile={r.activeFile}
        onSetLanguage={(lang) => r.activeFile && r.setFileLanguage(r.activeFile.id, lang)}
      />

      <SnapshotsModal
        open={snapshotsModalOpen}
        onClose={() => setSnapshotsModalOpen(false)}
        snapshots={r.snapshots}
        onSaveSnapshot={r.saveSnapshot}
        onRestoreSnapshot={r.restoreSnapshot}
        onDeleteSnapshot={r.deleteSnapshot}
      />
    </div>
  );
}

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [name, setName] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setName(sessionStorage.getItem("sandbox-name"));
    setChecked(true);
  }, []);

  if (!checked) return null;
  if (!name) return <NamePrompt onDone={(n) => { sessionStorage.setItem("sandbox-name", n); setName(n); }} />;
  return <Room roomId={roomId} name={name} />;
}

