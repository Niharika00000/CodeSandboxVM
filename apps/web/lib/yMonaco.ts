import type * as Y from "yjs";
import type { editor } from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";

/**
 * Minimal Y.Text <-> Monaco binding (no y-monaco dependency).
 *  - Monaco edits become fine-grained Y.Text insert/delete operations (never "replace the whole document").
 *  - Remote Y.Text deltas are applied to the Monaco model as minimal edits.
 */
export function bindYTextToMonaco(ytext: Y.Text, ed: editor.IStandaloneCodeEditor, monaco: Monaco): () => void {
  const model = ed.getModel()!;
  const doc = ytext.doc!;
  model.setEOL(monaco.editor.EndOfLineSequence.LF);
  model.setValue(ytext.toString());
  let applyingRemote = false;

  const sub = ed.onDidChangeModelContent((e) => {
    if (applyingRemote) return;
    doc.transact(() => {
      // apply from the end so earlier offsets stay valid
      [...e.changes]
        .sort((a, b) => b.rangeOffset - a.rangeOffset)
        .forEach((c) => {
          if (c.rangeLength > 0) ytext.delete(c.rangeOffset, c.rangeLength);
          if (c.text.length > 0) ytext.insert(c.rangeOffset, c.text);
        });
    }, "local");
  });

  const observer = (ev: Y.YTextEvent, tr: Y.Transaction) => {
    if (tr.origin === "local") return;
    applyingRemote = true;
    try {
      let idx = 0;
      const edits: editor.IIdentifiedSingleEditOperation[] = [];
      for (const d of ev.delta) {
        if (d.retain) idx += d.retain;
        else if (d.insert !== undefined) {
          const p = model.getPositionAt(idx);
          edits.push({ range: new monaco.Range(p.lineNumber, p.column, p.lineNumber, p.column), text: String(d.insert), forceMoveMarkers: true });
        } else if (d.delete) {
          const s = model.getPositionAt(idx);
          const e = model.getPositionAt(idx + d.delete);
          edits.push({ range: new monaco.Range(s.lineNumber, s.column, e.lineNumber, e.column), text: "" });
          idx += d.delete;
        }
      }
      model.applyEdits(edits);
    } finally {
      applyingRemote = false;
    }
  };
  ytext.observe(observer);

  return () => {
    sub.dispose();
    ytext.unobserve(observer);
  };
}
