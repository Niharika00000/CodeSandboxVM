"use client";
import { useRef, useState } from "react";
import type { FileMeta } from "@sandbox/shared";

interface Props {
  files: FileMeta[];
  activeFileId?: string;
  onOpen: (id: string) => void;
  onNewFile: () => void;
  onImportFiles: (list: FileList) => void;
  onImportFolder: (list: FileList) => void;
  onRenameFile?: (id: string, newName: string) => void;
  onDeleteFile?: (id: string) => void;
  onDuplicateFile?: (id: string) => void;
  onExportZip?: () => void;
  open?: boolean;
}

const ICONS: Record<string, { label: string; color: string }> = {
  javascript: { label: "JS", color: "text-[#f7df1e]" },
  typescript: { label: "TS", color: "text-[#3178c6]" },
  python:     { label: "PY", color: "text-[#3572a5]" },
  c:          { label: "C",  color: "text-[#555555]" },
  cpp:        { label: "C+", color: "text-[#f34b7d]" },
  java:       { label: "J",  color: "text-[#b07219]" },
  go:         { label: "GO", color: "text-[#00add8]" },
  rust:       { label: "RS", color: "text-[#dea584]" },
  shell:      { label: "SH", color: "text-[#89e051]" },
  ruby:       { label: "RB", color: "text-[#701516]" },
  php:        { label: "PHP", color: "text-[#4f5d95]" },
  json:       { label: "{}", color: "text-[#cbcb41]" },
  markdown:   { label: "M",  color: "text-[#083fa1]" },
  css:        { label: "#",  color: "text-[#563d7c]" },
  html:       { label: "<>", color: "text-[#e34c26]" },
  yaml:       { label: "Y",  color: "text-[#cb171e]" },
};

export default function FileExplorer({
  files,
  activeFileId,
  onOpen,
  onNewFile,
  onImportFiles,
  onImportFolder,
  onRenameFile,
  onDeleteFile,
  onDuplicateFile,
  onExportZip,
  open = true,
}: Props) {
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  if (!open) return null;

  const startRename = (f: FileMeta) => {
    setEditingId(f.id);
    setEditingName(f.name);
  };

  const handleFinishRename = (id: string) => {
    if (editingName.trim() && onRenameFile) {
      onRenameFile(id, editingName.trim());
    }
    setEditingId(null);
  };

  return (
    <nav className="hidden w-56 shrink-0 flex-col border-r border-line bg-[#11131a] p-2 text-sm md:flex select-none" aria-label="Files">
      <div className="mb-2 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-dim">
        <span>Files ({files.length})</span>
        <button
          onClick={onNewFile}
          title="Create new file"
          aria-label="New file"
          className="rounded p-1 leading-none text-dim hover:bg-raised hover:text-fg transition-colors"
        >
          ＋
        </button>
      </div>

      <ul className="mb-2 flex-1 space-y-0.5 overflow-y-auto">
        {files.map((f) => {
          const icon = ICONS[f.language] ?? { label: "•", color: "text-accent" };
          const isActive = f.id === activeFileId;
          const isEditing = editingId === f.id;

          if (isEditing) {
            return (
              <li key={f.id} className="p-1">
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleFinishRename(f.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleFinishRename(f.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="w-full rounded border border-accent bg-[#0a0c10] px-2 py-0.5 font-mono text-xs text-fg outline-none"
                />
              </li>
            );
          }

          return (
            <li key={f.id} className="group relative flex items-center">
              <button
                onClick={() => onOpen(f.id)}
                className={`flex w-full items-center gap-2 truncate rounded-md px-2 py-1 text-left font-mono text-[12.5px] transition-colors pr-14 ${
                  isActive
                    ? "bg-accent/15 text-accent font-medium border border-accent/30 shadow-sm"
                    : "text-dim hover:bg-raised/70 hover:text-fg border border-transparent"
                }`}
              >
                <span className={`w-5 shrink-0 text-center text-[10px] font-bold ${icon.color}`}>
                  {icon.label}
                </span>
                <span className="truncate">{f.name}</span>
              </button>

              {/* Action buttons on hover */}
              <div className="absolute right-1 hidden items-center gap-0.5 group-hover:flex bg-raised/90 backdrop-blur rounded px-1 py-0.5 shadow-sm">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(f);
                  }}
                  title="Rename"
                  className="p-0.5 text-[11px] text-dim hover:text-fg"
                >
                  ✏️
                </button>
                {onDuplicateFile && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateFile(f.id);
                    }}
                    title="Duplicate"
                    className="p-0.5 text-[11px] text-dim hover:text-fg"
                  >
                    📑
                  </button>
                )}
                {onDeleteFile && files.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete ${f.name}?`)) onDeleteFile(f.id);
                    }}
                    title="Delete"
                    className="p-0.5 text-[11px] text-dim hover:text-bad"
                  >
                    🗑
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Import / Export action bar */}
      <div className="space-y-1.5 border-t border-line/60 pt-2 text-xs">
        {onExportZip && (
          <button
            onClick={onExportZip}
            className="w-full flex items-center justify-between rounded-md border border-line/80 bg-raised/30 px-2.5 py-1 text-left text-xs text-dim hover:border-accent hover:text-accent transition-colors"
          >
            <span>📦 Download as .zip</span>
            <span className="text-[10px] text-dim">Export</span>
          </button>
        )}
        <button
          onClick={() => filesInput.current?.click()}
          className="w-full rounded-md border border-line/80 bg-raised/30 px-2.5 py-1 text-left text-xs text-dim hover:bg-raised hover:text-fg transition-colors"
        >
          📄 Open with Files…
        </button>
        <button
          onClick={() => folderInput.current?.click()}
          className="w-full rounded-md border border-line/80 bg-raised/30 px-2.5 py-1 text-left text-xs text-dim hover:bg-raised hover:text-fg transition-colors"
        >
          📁 Open with Folder…
        </button>
      </div>

      {/* Hidden native pickers */}
      <input
        ref={filesInput}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onImportFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={folderInput}
        type="file"
        multiple
        className="hidden"
        // @ts-expect-error webkitdirectory is standard in all modern browsers
        webkitdirectory=""
        directory=""
        onChange={(e) => {
          if (e.target.files?.length) onImportFolder(e.target.files);
          e.target.value = "";
        }}
      />
    </nav>
  );
}

