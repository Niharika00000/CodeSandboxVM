"use client";
import { useEffect, useState, useMemo } from "react";
import type { FileMeta } from "@sandbox/shared";
import type * as Y from "yjs";

interface Props {
  doc: Y.Doc;
  files: FileMeta[];
  activeFile?: FileMeta;
}

export default function WebPreview({ doc, files, activeFile }: Props) {
  const [srcDoc, setSrcDoc] = useState("");
  const [key, setKey] = useState(0);

  // Synthesize complete HTML document by combining html, css, and js from the room
  const previewHtml = useMemo(() => {
    let html = "";
    let css = "";
    let js = "";

    // Find the best HTML file: either active file if it's html, or index.html / first .html
    const htmlFiles = files.filter((f) => f.language === "html" || f.name.endsWith(".html"));
    const targetHtmlFile =
      activeFile && (activeFile.language === "html" || activeFile.name.endsWith(".html"))
        ? activeFile
        : htmlFiles[0];

    if (targetHtmlFile) {
      html = doc.getText(`file:${targetHtmlFile.id}`).toString();
    } else {
      html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>body { font-family: system-ui, sans-serif; padding: 2rem; color: #333; }</style>
</head>
<body>
  <h2>Web Preview</h2>
  <p>Create an <code>index.html</code> file or switch to an HTML file to preview web layouts live.</p>
</body>
</html>`;
    }

    // Collect all CSS files
    files.forEach((f) => {
      if (f.language === "css" || f.name.endsWith(".css")) {
        css += `\n/* ${f.name} */\n` + doc.getText(`file:${f.id}`).toString();
      }
    });

    // Collect JS files (only non-runnable node scripts or client scripts)
    files.forEach((f) => {
      if ((f.language === "javascript" || f.name.endsWith(".js")) && f.name.toLowerCase() !== "server.js") {
        js += `\n// ${f.name}\n` + doc.getText(`file:${f.id}`).toString();
      }
    });

    // Inject css and js into the HTML
    let combined = html;
    if (css) {
      combined = combined.replace("</head>", `<style>${css}</style></head>`);
      if (!combined.includes("<style>")) {
        combined = `<style>${css}</style>` + combined;
      }
    }
    if (js) {
      combined = combined.replace("</body>", `<script>${js}</script></body>`);
      if (!combined.includes("<script>")) {
        combined += `<script>${js}</script>`;
      }
    }

    return combined;
  }, [doc, files, activeFile]);

  useEffect(() => {
    setSrcDoc(previewHtml);
  }, [previewHtml]);

  const handleRefresh = () => {
    setKey((k) => k + 1);
  };

  const handleOpenNewWindow = () => {
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[#0c0d12]" aria-label="Live web preview">
      {/* Header bar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-line bg-[#11131a] px-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-sm">🌐</span>
          <span className="font-semibold text-fg font-mono text-[11px]">Live Web Preview</span>
          <span className="rounded-full bg-ok/15 text-ok text-[10px] px-2 py-0.2 font-medium">
            Active iframe sandbox
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-dim hover:bg-raised hover:text-fg transition-colors"
            title="Reload preview"
          >
            🔄 Reload
          </button>
          <button
            onClick={handleOpenNewWindow}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-accent hover:bg-accent/15 transition-colors"
            title="Open preview in new tab"
          >
            ↗ Open Tab
          </button>
        </div>
      </div>

      {/* iframe preview container */}
      <div className="min-h-0 flex-1 bg-white relative">
        <iframe
          key={key}
          srcDoc={srcDoc}
          title="Sandbox Web Preview"
          sandbox="allow-scripts allow-modals"
          className="h-full w-full border-none"
        />
      </div>
    </div>
  );
}

