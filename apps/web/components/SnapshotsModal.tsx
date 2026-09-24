"use client";
import { useState } from "react";
import type { SnapshotItem } from "@/hooks/useRoom";

interface Props {
  open: boolean;
  onClose: () => void;
  snapshots: SnapshotItem[];
  onSaveSnapshot: (name: string) => void;
  onRestoreSnapshot: (id: string) => void;
  onDeleteSnapshot: (id: string) => void;
}

export default function SnapshotsModal({
  open,
  onClose,
  snapshots,
  onSaveSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
}: Props) {
  const [name, setName] = useState("");
  const [restoredId, setRestoredId] = useState<string | null>(null);

  if (!open) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSaveSnapshot(name.trim());
      setName("");
    }
  };

  const handleRestore = (id: string) => {
    onRestoreSnapshot(id);
    setRestoredId(id);
    setTimeout(() => {
      setRestoredId(null);
      onClose();
    }, 1000);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-panel p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📸</span>
            <div>
              <h2 className="text-base font-semibold text-fg">Code Snapshots & Version History</h2>
              <p className="text-xs text-dim">Create named checkpoints and restore previous versions in real-time.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-dim hover:bg-raised hover:text-fg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Create Snapshot Form */}
        <form onSubmit={handleSave} className="mt-4 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Working solution before refactor"
            maxLength={60}
            className="min-w-0 flex-1 rounded-xl border border-line bg-[#0a0c10] px-3.5 py-2 text-xs text-fg placeholder:text-dim/60 outline-none focus:border-accent transition-colors"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-bg hover:brightness-110 disabled:opacity-40 transition-all shadow-sm shadow-accent/20"
          >
            Save Snapshot
          </button>
        </form>

        {/* Snapshots list */}
        <div className="mt-4 max-h-72 overflow-y-auto space-y-2 pr-1">
          {snapshots.length === 0 && (
            <div className="py-8 text-center text-xs text-dim">
              No snapshots created yet. Name your current work above to create a restore point.
            </div>
          )}

          {snapshots.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-line/80 bg-[#10131a] p-3 text-xs transition-colors hover:border-line"
            >
              <div>
                <p className="font-semibold text-fg">{s.name}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-dim">
                  <span>By {s.author}</span>
                  <span>·</span>
                  <span>{new Date(s.timestamp).toLocaleString()}</span>
                  <span>·</span>
                  <span className="font-mono text-accent">{s.files.length} file(s)</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRestore(s.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    restoredId === s.id
                      ? "bg-ok text-bg"
                      : "bg-raised border border-line text-fg hover:border-accent hover:text-accent"
                  }`}
                >
                  {restoredId === s.id ? "✓ Restored!" : "Restore"}
                </button>
                <button
                  onClick={() => onDeleteSnapshot(s.id)}
                  title="Delete snapshot"
                  className="rounded p-1 text-dim/60 hover:text-bad transition-colors"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
