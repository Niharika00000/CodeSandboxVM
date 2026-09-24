"use client";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import * as Y from "yjs";
import type { ChatEntry, ClientMessage, ExecutionLimits, FileMeta, SandboxStatus, ServerMessage, UserInfo } from "@sandbox/shared";
import { WS_URL, API_URL } from "@/lib/config";
import { fromB64, toB64 } from "@/lib/b64";
import { getTemplateForLanguage, languageForName } from "@/lib/language";
import { downloadZip } from "@/lib/zip";

export type ConnState = "connecting" | "connected" | "reconnecting" | "closed";
export type Outcome = "running" | "completed" | "timeout" | "failed";

export interface TermChunk { kind: "stdout" | "stderr" | "system"; text: string }
export interface ExecState {
  executionId?: string;
  startedBy?: string;
  limits?: ExecutionLimits;
  statuses: SandboxStatus[];
  outcome?: Outcome;
  exitCode?: number;
  durationMs?: number;
  reason?: string;
  chunks: TermChunk[];
}
const initialExec: ExecState = { statuses: [], chunks: [] };
const MAIN_FILE_ID = "main";

type Action = { type: "server"; msg: ServerMessage } | { type: "clear" };

function execReducer(s: ExecState, a: Action): ExecState {
  if (a.type === "clear") return initialExec;
  const m = a.msg;
  switch (m.type) {
    case "EXECUTION_STARTED":
      return { executionId: m.executionId, startedBy: m.startedBy, limits: m.limits, statuses: [], outcome: "running",
        chunks: [{ kind: "system", text: `Execution started by ${m.startedBy}...\n` }] };
    case "SANDBOX_STATUS":
      return m.executionId === s.executionId ? { ...s, statuses: [...s.statuses, m.status] } : s;
    case "STDOUT":
      return m.executionId === s.executionId ? { ...s, chunks: [...s.chunks, { kind: "stdout", text: m.data }] } : s;
    case "STDERR":
      return m.executionId === s.executionId ? { ...s, chunks: [...s.chunks, { kind: "stderr", text: m.data }] } : s;
    case "EXECUTION_COMPLETED":
      return { ...s, outcome: "completed", exitCode: m.exitCode, durationMs: m.durationMs,
        chunks: [...s.chunks, { kind: "system", text: `\nExecution completed in ${(m.durationMs / 1000).toFixed(2)}s (exit code ${m.exitCode})\n` }] };
    case "EXECUTION_TIMEOUT":
      return { ...s, outcome: "timeout", durationMs: m.durationMs, reason: "TIMEOUT",
        chunks: [...s.chunks, { kind: "system", text: `\nEXECUTION TERMINATED\nReason: TIMEOUT\nSandbox terminated - resources released\n` }] };
    case "EXECUTION_FAILED":
      return { ...s, outcome: "failed", durationMs: m.durationMs, reason: m.reason,
        chunks: [...s.chunks, { kind: "system", text: `\nEXECUTION FAILED\nReason: ${m.reason}\n` }] };
    default:
      return s;
  }
}

/** Reads a browser File as UTF-8 text. */
function readFileAsText(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error);
    r.readAsText(f);
  });
}

export interface AiChatMessageItem {
  id: string;
  role: "user" | "assistant";
  text: string;
  suggestedCode?: string;
  timestamp: number;
}

export interface SnapshotItem {
  id: string;
  name: string;
  timestamp: number;
  author: string;
  files: { id: string; meta: FileMeta; content: string }[];
}

export function useRoom(roomId: string, name: string | null) {
  const doc = useMemo(() => new Y.Doc(), []);
  const wsRef = useRef<WebSocket | null>(null);
  const [conn, setConn] = useState<ConnState>("connecting");
  const [synced, setSynced] = useState(false);
  const [me, setMe] = useState<UserInfo | null>(null);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [exec, dispatch] = useReducer(execReducer, initialExec);
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>(MAIN_FILE_ID);
  const meRef = useRef<UserInfo | null>(null);
  meRef.current = me;

  // Presenter Mode (stored in Y.Map "meta")
  const [presenterId, setPresenterId] = useState<string | null>(null);
  // Snapshots (stored in Y.Map "snapshots")
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);

  // AI Chat Assistant State
  const [aiChatMessages, setAiChatMessages] = useState<AiChatMessageItem[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hello! I am your AI Copilot. Ask me to explain code, optimize algorithms, write unit tests, or fix errors.",
      timestamp: Date.now(),
    },
  ]);
  const [aiChatLoading, setAiChatLoading] = useState(false);

  const send = useCallback((m: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
  }, []);

  // Forward local Yjs updates as CRDT_UPDATE
  useEffect(() => {
    const onUpdate = (u: Uint8Array, origin: unknown) => {
      if (origin === "remote") return;
      send({ type: "CRDT_UPDATE", update: toB64(u) });
    };
    doc.on("update", onUpdate);
    return () => doc.off("update", onUpdate);
  }, [doc, send]);

  // Mirror shared files map
  useEffect(() => {
    const filesMap = doc.getMap<FileMeta>("files");
    const sync = () => {
      const list = [...filesMap.values()].sort((a, b) => a.name.localeCompare(b.name));
      setFiles(list);
      setOpenTabs((tabs) => tabs.filter((id) => filesMap.has(id)));
      setActiveFileId((cur) => (filesMap.has(cur) ? cur : list[0]?.id ?? MAIN_FILE_ID));
    };
    filesMap.observe(sync);
    sync();
    return () => filesMap.unobserve(sync);
  }, [doc]);

  // Mirror shared room metadata (Presenter mode & Snapshots)
  useEffect(() => {
    const metaMap = doc.getMap<string>("roomMeta");
    const syncMeta = () => {
      setPresenterId(metaMap.get("presenterId") ?? null);
    };
    metaMap.observe(syncMeta);
    syncMeta();

    const snapsMap = doc.getMap<SnapshotItem>("snapshots");
    const syncSnaps = () => {
      const list = [...snapsMap.values()].sort((a, b) => b.timestamp - a.timestamp);
      setSnapshots(list);
    };
    snapsMap.observe(syncSnaps);
    syncSnaps();

    return () => {
      metaMap.unobserve(syncMeta);
      snapsMap.unobserve(syncSnaps);
    };
  }, [doc]);

  useEffect(() => {
    if (!name) return;
    let closedByUs = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout>;

    const connect = () => {
      setConn(retry === 0 ? "connecting" : "reconnecting");
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: "JOIN_ROOM", roomId, name } satisfies ClientMessage));
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data as string) as ServerMessage;
        switch (m.type) {
          case "SYNC_STATE":
            Y.applyUpdate(doc, fromB64(m.update), "remote");
            send({ type: "CRDT_UPDATE", update: toB64(Y.encodeStateAsUpdate(doc)) });
            setMe(m.you); setUsers(m.users); setChat(m.chatHistory); setSynced(true); setConn("connected"); retry = 0; setError(null);
            break;
          case "CRDT_UPDATE": Y.applyUpdate(doc, fromB64(m.update), "remote"); break;
          case "USER_JOINED": setUsers((u) => [...u.filter((x) => x.id !== m.user.id), m.user]); break;
          case "USER_LEFT": setUsers((u) => u.filter((x) => x.id !== m.userId)); break;
          case "CURSOR_UPDATE": setUsers((u) => u.map((x) => (x.id === m.userId ? { ...x, anchor: m.anchor, head: m.head, cursors: [{ anchor: m.anchor, head: m.head }] } : x))); break;
          case "MULTI_CURSOR_UPDATE": setUsers((u) => u.map((x) => (x.id === m.userId ? { ...x, cursors: m.cursors, anchor: m.cursors[0]?.anchor, head: m.cursors[0]?.head } : x))); break;
          case "CHAT_MESSAGE":
            setChat((c) => [...c, m.entry]);
            if (m.entry.userId !== meRef.current?.id) setUnreadChat((n) => n + 1);
            break;
          case "ERROR":
            if (m.code === "ROOM_NOT_FOUND" || m.code === "ROOM_FULL") setFatal(m.message);
            else setError(m.message);
            break;
          default: dispatch({ type: "server", msg: m });
        }
      };
      ws.onclose = () => {
        if (closedByUs) return;
        setConn("reconnecting");
        retry++;
        timer = setTimeout(() => { if (!closedByUs) connect(); }, Math.min(1000 * 2 ** retry, 8000));
      };
    };
    connect();
    return () => { closedByUs = true; clearTimeout(timer); wsRef.current?.close(); setConn("closed"); };
  }, [roomId, name, doc, send]);

  useEffect(() => { if (fatal) { setConn("closed"); wsRef.current?.close(); } }, [fatal]);

  const openFile = useCallback((id: string) => {
    setOpenTabs((tabs) => (tabs.includes(id) ? tabs : [...tabs, id]));
    setActiveFileId(id);
  }, []);

  const closeTab = useCallback((id: string) => {
    setOpenTabs((tabs) => {
      const next = tabs.filter((t) => t !== id);
      setActiveFileId((cur) => (cur === id ? next[next.length - 1] ?? MAIN_FILE_ID : cur));
      return next;
    });
  }, []);

  const createFile = useCallback((fileName: string, content?: string) => {
    const filesMap = doc.getMap<FileMeta>("files");
    if (filesMap.size >= 40) { setError("File limit reached (40)."); return undefined; }
    const id = `f_${Math.random().toString(36).slice(2, 10)}`;
    const lang = languageForName(fileName);
    const meta: FileMeta = { id, name: fileName.slice(0, 80), language: lang };
    const initialContent = content !== undefined ? content : getTemplateForLanguage(lang);
    doc.transact(() => {
      filesMap.set(id, meta);
      doc.getText(`file:${id}`).insert(0, initialContent);
    });
    openFile(id);
    return id;
  }, [doc, openFile]);

  const renameFile = useCallback((fileId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const filesMap = doc.getMap<FileMeta>("files");
    const existing = filesMap.get(fileId);
    if (!existing) return;
    const lang = languageForName(trimmed);
    filesMap.set(fileId, { ...existing, name: trimmed, language: lang });
  }, [doc]);

  const deleteFile = useCallback((fileId: string) => {
    const filesMap = doc.getMap<FileMeta>("files");
    if (filesMap.size <= 1) {
      setError("Cannot delete the only remaining file in the room.");
      return;
    }
    filesMap.delete(fileId);
    closeTab(fileId);
  }, [closeTab, doc]);

  const duplicateFile = useCallback((fileId: string) => {
    const filesMap = doc.getMap<FileMeta>("files");
    const existing = filesMap.get(fileId);
    if (!existing) return;
    const content = doc.getText(`file:${fileId}`).toString();
    const parts = existing.name.split(".");
    const ext = parts.length > 1 ? `.${parts.pop()}` : "";
    const base = parts.join(".");
    createFile(`${base}-copy${ext}`, content);
  }, [createFile, doc]);

  const exportAllFilesZip = useCallback(() => {
    const filesMap = doc.getMap<FileMeta>("files");
    const list: { name: string; content: string }[] = [];
    for (const [id, meta] of filesMap.entries()) {
      list.push({
        name: meta.name,
        content: doc.getText(`file:${id}`).toString(),
      });
    }
    downloadZip(`collab-sandbox-${roomId}`, list);
  }, [doc, roomId]);

  /** 1-Click Replace/Patch file content via Y.js (syncs instantly across all peers) */
  const applyCodeToEditor = useCallback((newCode: string, targetFileId?: string) => {
    const fId = targetFileId || activeFileId;
    if (!fId) return;
    const yText = doc.getText(`file:${fId}`);
    doc.transact(() => {
      yText.delete(0, yText.length);
      yText.insert(0, newCode);
    });
  }, [activeFileId, doc]);

  const setFileLanguage = useCallback((fileId: string, language: string) => {
    const filesMap = doc.getMap<FileMeta>("files");
    const existing = filesMap.get(fileId);
    if (!existing) return;
    filesMap.set(fileId, { ...existing, language });
  }, [doc]);

  const importFiles = useCallback(async (fileList: FileList) => {
    for (const f of Array.from(fileList).slice(0, 20)) {
      const text = await readFileAsText(f);
      createFile(f.name, text.slice(0, 20_000));
    }
  }, [createFile]);

  const importFolder = useCallback(async (fileList: FileList) => {
    for (const f of Array.from(fileList).slice(0, 40)) {
      const text = await readFileAsText(f);
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      createFile(rel, text.slice(0, 20_000));
    }
  }, [createFile]);

  const sendChat = useCallback((text: string) => {
    if (text.trim()) send({ type: "CHAT_MESSAGE", text: text.trim() });
  }, [send]);

  const sendStdin = useCallback((data: string) => send({ type: "STDIN", data }), [send]);

  // AI Review
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<import("@/components/AiReviewPanel").ReviewResult | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const activeFile = files.find((f) => f.id === activeFileId) ?? files[0];

  const reviewCode = useCallback(async (targetFileId?: string) => {
    const fId = targetFileId || activeFileId;
    if (!fId) return null;
    const targetFile = files.find((f) => f.id === fId) ?? activeFile;
    if (!targetFile) return null;
    const code = doc.getText(`file:${fId}`).toString();
    if (!code.trim()) {
      setReviewError("Cannot review an empty file. Write some code first.");
      return null;
    }
    setReviewLoading(true);
    setReviewError(null);
    try {
      const res = await fetch(`${API_URL}/api/ai/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language: targetFile.language || "javascript",
          filename: targetFile.name,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Review failed (${res.status})`);
      }
      const data = (await res.json()) as import("@/components/AiReviewPanel").ReviewResult;
      setReviewResult(data);
      return data;
    } catch (err) {
      const msg = (err as Error).message || "Failed to generate AI review";
      setReviewError(msg);
      return null;
    } finally {
      setReviewLoading(false);
    }
  }, [activeFile, activeFileId, doc, files]);

  const explainError = useCallback(async (stderr: string, code?: string, language?: string) => {
    try {
      const activeCode = code ?? (activeFile ? doc.getText(`file:${activeFile.id}`).toString() : "");
      const res = await fetch(`${API_URL}/api/ai/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: stderr,
          code: activeCode,
          language: language || activeFile?.language || "javascript",
        }),
      });
      if (!res.ok) return null;
      return (await res.json()) as { explanation: string; fix?: string };
    } catch {
      return null;
    }
  }, [activeFile, doc]);

  /** Interactive AI Assistant Copilot chat */
  const sendAiChat = useCallback(async (userPrompt: string) => {
    if (!userPrompt.trim()) return;
    const userMsg: AiChatMessageItem = {
      id: `u_${Date.now()}`,
      role: "user",
      text: userPrompt.trim(),
      timestamp: Date.now(),
    };
    setAiChatMessages((prev) => [...prev, userMsg]);
    setAiChatLoading(true);

    const activeCode = activeFile ? doc.getText(`file:${activeFile.id}`).toString() : "";
    try {
      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: userPrompt }],
          code: activeCode,
          language: activeFile?.language || "javascript",
          filename: activeFile?.name || "active file",
        }),
      });
      if (!res.ok) throw new Error("AI service unavailable");
      const data = (await res.json()) as { reply: string; suggestedCode?: string };
      const assistantMsg: AiChatMessageItem = {
        id: `a_${Date.now()}`,
        role: "assistant",
        text: data.reply,
        suggestedCode: data.suggestedCode,
        timestamp: Date.now(),
      };
      setAiChatMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setAiChatMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          text: "I couldn't process that request right now. Check server connectivity or try a different question.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setAiChatLoading(false);
    }
  }, [activeFile, doc]);

  /** Presenter mode toggle */
  const togglePresenter = useCallback(() => {
    if (!me) return;
    const metaMap = doc.getMap<string>("roomMeta");
    const current = metaMap.get("presenterId");
    if (current === me.id) {
      metaMap.delete("presenterId");
    } else {
      metaMap.set("presenterId", me.id);
    }
  }, [doc, me]);

  /** Snapshot operations */
  const saveSnapshot = useCallback((snapshotName: string) => {
    if (!me) return;
    const snapsMap = doc.getMap<SnapshotItem>("snapshots");
    const filesMap = doc.getMap<FileMeta>("files");
    const snapFiles: { id: string; meta: FileMeta; content: string }[] = [];
    for (const [fId, meta] of filesMap.entries()) {
      snapFiles.push({
        id: fId,
        meta,
        content: doc.getText(`file:${fId}`).toString(),
      });
    }
    const snap: SnapshotItem = {
      id: `snap_${Date.now()}`,
      name: snapshotName.trim() || `Snapshot ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      timestamp: Date.now(),
      author: me.name,
      files: snapFiles,
    };
    snapsMap.set(snap.id, snap);
  }, [doc, me]);

  const restoreSnapshot = useCallback((snapshotId: string) => {
    const snapsMap = doc.getMap<SnapshotItem>("snapshots");
    const snap = snapsMap.get(snapshotId);
    if (!snap) return;

    doc.transact(() => {
      const filesMap = doc.getMap<FileMeta>("files");
      // Clear existing files and restore from snapshot
      filesMap.clear();
      for (const item of snap.files) {
        filesMap.set(item.id, item.meta);
        const yText = doc.getText(`file:${item.id}`);
        yText.delete(0, yText.length);
        yText.insert(0, item.content);
      }
    });
    if (snap.files[0]) {
      openFile(snap.files[0].id);
    }
  }, [doc, openFile]);

  const deleteSnapshot = useCallback((snapshotId: string) => {
    doc.getMap<SnapshotItem>("snapshots").delete(snapshotId);
  }, [doc]);

  const fetchAiSuggestion = useCallback(async (prefix: string, suffix: string, language: string): Promise<string> => {
    try {
      const res = await fetch(`${API_URL}/api/ai/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, suffix, language }),
      });
      if (!res.ok) return "";
      const data = (await res.json()) as { suggestion?: string };
      return data.suggestion ?? "";
    } catch {
      return "";
    }
  }, []);

  const isPresenter = presenterId === me?.id;
  const isReadOnly = Boolean(presenterId && presenterId !== me?.id);
  const presenterUser = users.find((u) => u.id === presenterId);
  const presenterName = presenterUser?.name || "Host";

  return {
    doc, conn, synced, me, users, error, fatal, exec,
    files, openTabs, activeFile, activeFileId,
    chat, unreadChat,
    reviewLoading, reviewResult, reviewError,
    aiChatMessages, aiChatLoading, sendAiChat, clearAiChat: () => setAiChatMessages([]),
    presenterId, isPresenter, isReadOnly, presenterName, togglePresenter,
    snapshots, saveSnapshot, restoreSnapshot, deleteSnapshot,
    clearError: () => setError(null),
    clearTerminal: () => dispatch({ type: "clear" }),
    clearUnreadChat: () => setUnreadChat(0),
    clearReview: () => { setReviewResult(null); setReviewError(null); },
    reviewCode,
    explainError,
    applyCodeToEditor,
    renameFile,
    deleteFile,
    duplicateFile,
    exportAllFilesZip,
    run: () => {
      setError(null);
      const lang = activeFile?.language || "javascript";
      send({ type: "RUN_CODE", language: lang, fileId: activeFileId });
    },
    stop: () => send({ type: "STOP_CODE" }),
    sendCursor: (anchor: number, head: number) => send({ type: "CURSOR_UPDATE", anchor, head }),
    sendMultiCursor: (cursors: import("@sandbox/shared").CursorRange[]) => {
      if (cursors.length === 0) return;
      if (cursors.length === 1) {
        send({ type: "CURSOR_UPDATE", anchor: cursors[0]!.anchor, head: cursors[0]!.head });
      } else {
        send({ type: "MULTI_CURSOR_UPDATE", cursors });
      }
    },
    sendChat, sendStdin, fetchAiSuggestion,
    openFile, closeTab, createFile, setFileLanguage, importFiles, importFolder,
  };
}
