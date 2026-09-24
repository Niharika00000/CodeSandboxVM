"use client";
import { useEffect, useRef } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor, IDisposable } from "monaco-editor";
import type * as Y from "yjs";
import type { FileMeta, UserInfo, CursorRange } from "@sandbox/shared";
import { bindYTextToMonaco } from "@/lib/yMonaco";

interface Props {
  doc: Y.Doc;
  file: FileMeta;
  me: UserInfo | null;
  users: UserInfo[];
  onCursor: (anchor: number, head: number) => void;
  onMultiCursor?: (cursors: CursorRange[]) => void;
  aiEnabled: boolean;
  fetchSuggestion: (prefix: string, suffix: string, language: string) => Promise<string>;
  readOnly?: boolean;
}

const AI_LANGUAGES = ["javascript", "typescript", "python", "json", "markdown", "plaintext", "css", "html", "go", "rust", "java", "c", "cpp", "shell", "yaml"];

export default function CodeEditor({ doc, file, me, users, onCursor, onMultiCursor, aiEnabled, fetchSuggestion, readOnly }: Props) {
  const edRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decoRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  const unbind = useRef<(() => void) | null>(null);
  const cursorCb = useRef(onCursor);
  cursorCb.current = onCursor;
  const multiCursorCb = useRef(onMultiCursor);
  multiCursorCb.current = onMultiCursor;
  const aiEnabledRef = useRef(aiEnabled);
  aiEnabledRef.current = aiEnabled;
  const fetchSuggestionRef = useRef(fetchSuggestion);
  fetchSuggestionRef.current = fetchSuggestion;
  const aiProvidersRef = useRef<IDisposable[]>([]);
  const aiRegistered = useRef(false);
  // Throttle cursor broadcast
  const cursorThrottle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const onMount: OnMount = (ed, monaco) => {
    unbind.current?.();
    edRef.current = ed;
    monacoRef.current = monaco;
    decoRef.current = ed.createDecorationsCollection([]);
    unbind.current = bindYTextToMonaco(doc.getText(`file:${file.id}`), ed, monaco);

    // Listen to ALL selection changes including multi-cursor (Ctrl+D, Alt+Click, etc.)
    ed.onDidChangeCursorSelection((e) => {
      const m = ed.getModel();
      if (!m) return;

      // Collect primary + secondary selections (multi-cursor)
      const allSelections = [e.selection, ...e.secondarySelections];
      const cursors: CursorRange[] = allSelections.map((sel) => ({
        anchor: m.getOffsetAt(sel.getStartPosition()),
        head: m.getOffsetAt(sel.getEndPosition()),
      }));

      // Throttle to avoid flooding the server (max 30fps)
      clearTimeout(cursorThrottle.current);
      cursorThrottle.current = setTimeout(() => {
        // Legacy single cursor
        cursorCb.current(cursors[0]?.anchor ?? 0, cursors[0]?.head ?? 0);
        // Multi-cursor if callback exists
        if (multiCursorCb.current && cursors.length > 0) {
          multiCursorCb.current(cursors);
        }
      }, 33);
    });

    // AI ghost-text provider: registered once per page (Monaco is a singleton).
    if (aiRegistered.current) return;
    aiRegistered.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let seq = 0;
    for (const lang of AI_LANGUAGES) {
      aiProvidersRef.current.push(
        monaco.languages.registerInlineCompletionsProvider(lang, {
          freeInlineCompletions() {},
          disposeInlineCompletions() {},
          provideInlineCompletions: (model: any, position: any) =>
            new Promise((resolve) => {
              if (!aiEnabledRef.current) return resolve({ items: [] });
              clearTimeout(timer);
              const mySeq = ++seq;
              timer = setTimeout(async () => {
                const full = model.getValue();
                const offset = model.getOffsetAt(position);
                const prefix = full.slice(0, offset);
                const suffix = full.slice(offset, offset + 400);
                const text = await fetchSuggestionRef.current(prefix, suffix, model.getLanguageId());
                if (mySeq !== seq || !text) return resolve({ items: [] });
                resolve({ items: [{ insertText: text, range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column) }] });
              }, 400);
            }),
        } as any),
      );
    }
  };

  useEffect(
    () => () => {
      clearTimeout(cursorThrottle.current);
      unbind.current?.();
      aiProvidersRef.current.forEach((d) => d.dispose());
    },
    [],
  );

  // Render ALL remote cursors+selections for every user (multi-cursor aware).
  useEffect(() => {
    const ed = edRef.current, monaco = monacoRef.current, model = ed?.getModel();
    if (!ed || !monaco || !model || !decoRef.current) return;
    const max = model.getValueLength();
    const decos: editor.IModelDeltaDecoration[] = [];

    for (const u of users) {
      if (u.id === me?.id) continue;

      // Build list of cursor ranges: prefer multi-cursor array, fall back to single
      const ranges: CursorRange[] =
        u.cursors && u.cursors.length > 0
          ? u.cursors
          : u.head !== undefined && u.anchor !== undefined
          ? [{ anchor: u.anchor, head: u.head }]
          : [];

      for (let ci = 0; ci < ranges.length; ci++) {
        const cr = ranges[ci]!;
        const head = model.getPositionAt(Math.min(cr.head, max));
        const anchor = model.getPositionAt(Math.min(cr.anchor, max));

        // Cursor caret decoration — shows name label only on primary cursor (index 0)
        decos.push({
          range: new monaco.Range(head.lineNumber, head.column, head.lineNumber, head.column),
          options: {
            className: `rc-cursor rc-cursor-${u.colorIndex}`,
            hoverMessage: { value: `**${u.name}**${ranges.length > 1 ? ` (cursor ${ci + 1}/${ranges.length})` : ""}` },
            // Name chip only on the primary cursor to avoid visual clutter
            ...(ci === 0
              ? { after: { content: u.name, inlineClassName: `rc-label rc-label-${u.colorIndex}` } }
              : {}),
            zIndex: 100,
          },
        });

        // Selection highlight
        const startPos = cr.anchor < cr.head ? anchor : head;
        const endPos = cr.anchor < cr.head ? head : anchor;
        if (cr.anchor !== cr.head) {
          decos.push({
            range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
            options: {
              className: `rc-sel rc-sel-${u.colorIndex}`,
              zIndex: 50,
            },
          });
        }
      }
    }

    decoRef.current.set(decos);
  }, [users, me]);

  return (
    <Editor
      key={file.id}
      height="100%"
      language={file.language}
      theme="vs-dark"
      onMount={onMount}
      loading={<div className="p-4 text-dim text-sm">Loading editor...</div>}
      options={{
        fontSize: 14, minimap: { enabled: false }, automaticLayout: true, scrollBeyondLastLine: false,
        fontFamily: "ui-monospace, JetBrains Mono, Menlo, Consolas, monospace", padding: { top: 12 },
        renderLineHighlight: "line", smoothScrolling: false, tabSize: 2,
        inlineSuggest: { enabled: true },
        readOnly: Boolean(readOnly),
        // Enable multi-cursor features natively
        multiCursorModifier: "ctrlCmd",   // Ctrl+Click (or Cmd on macOS) adds cursors
        multiCursorLimit: 20,
        columnSelection: false,
      }}
    />
  );
}

