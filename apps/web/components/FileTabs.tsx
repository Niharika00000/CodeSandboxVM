"use client";
import { useEffect, useRef, useState } from "react";
import type { FileMeta } from "@sandbox/shared";

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

export default function FileTabs({
  files,
  openTabs,
  activeFileId,
  onSelect,
  onClose,
}: {
  files: FileMeta[];
  openTabs: string[];
  activeFileId?: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const seen = useRef<Set<string>>(new Set());
  const [justOpened, setJustOpened] = useState<string | null>(null);

  useEffect(() => {
    const fresh = openTabs.find((id) => !seen.current.has(id));
    if (fresh) {
      seen.current.add(fresh);
      setJustOpened(fresh);
      const t = setTimeout(() => setJustOpened((cur) => (cur === fresh ? null : cur)), 240);
      return () => clearTimeout(t);
    }
  }, [openTabs]);

  const byId = new Map<string, FileMeta>(files.map((f): [string, FileMeta] => [f.id, f]));
  if (openTabs.length === 0) return null;

  return (
    <div
      className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-line bg-[#0e1017] select-none"
      role="tablist"
      aria-label="Open files"
      style={{ perspective: "700px" }}
    >
      {openTabs.map((id) => {
        const f = byId.get(id);
        if (!f) return null;
        const active = id === activeFileId;
        const icon = ICONS[f.language] ?? { label: "•", color: "text-accent" };

        return (
          <div
            key={id}
            role="tab"
            aria-selected={active}
            className={`${justOpened === id ? "file-open-3d" : ""} group relative flex shrink-0 items-center gap-2 border-r border-line/80 px-3 text-[12.5px] transition-colors cursor-pointer ${
              active
                ? "bg-[#161922] text-fg font-medium"
                : "text-dim bg-transparent hover:bg-raised/40 hover:text-fg"
            }`}
          >
            {active && (
              <span className="absolute top-0 left-0 right-0 h-[2px] bg-accent" />
            )}
            <span className={`text-[10px] font-bold ${icon.color}`}>
              {icon.label}
            </span>
            <button
              onClick={() => onSelect(id)}
              className="font-mono text-left truncate max-w-[150px]"
            >
              {f.name}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(id);
              }}
              aria-label={`Close ${f.name}`}
              className="rounded p-0.5 text-dim/60 opacity-0 hover:bg-line hover:text-fg group-hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

