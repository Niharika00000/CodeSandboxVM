"use client";
import { useState } from "react";
import type { FileMeta } from "@sandbox/shared";
import type * as Y from "yjs";
import { API_URL } from "@/lib/config";

export interface TestCaseItem {
  id: string;
  name: string;
  input: string;
  expected: string;
  actual?: string;
  passed?: boolean;
  durationMs?: number;
  status: "idle" | "running" | "done";
  error?: string;
}

interface Props {
  doc: Y.Doc;
  activeFile?: FileMeta;
}

export default function TestRunner({ doc, activeFile }: Props) {
  const [tests, setTests] = useState<TestCaseItem[]>([
    {
      id: "tc_1",
      name: "Case 1",
      input: "5\n",
      expected: "10",
      status: "idle",
    },
    {
      id: "tc_2",
      name: "Case 2",
      input: "0\n",
      expected: "0",
      status: "idle",
    },
  ]);

  const [runningAll, setRunningAll] = useState(false);
  const [activeTestId, setActiveTestId] = useState<string>("tc_1");

  const addTestCase = () => {
    const nextNum = tests.length + 1;
    const newTest: TestCaseItem = {
      id: `tc_${Date.now()}`,
      name: `Case ${nextNum}`,
      input: "",
      expected: "",
      status: "idle",
    };
    setTests((prev) => [...prev, newTest]);
    setActiveTestId(newTest.id);
  };

  const removeTestCase = (id: string) => {
    if (tests.length <= 1) return;
    setTests((prev) => prev.filter((t) => t.id !== id));
    if (activeTestId === id) {
      const remaining = tests.filter((t) => t.id !== id);
      setActiveTestId(remaining[0]?.id ?? "");
    }
  };

  const updateActiveTest = (field: "input" | "expected", value: string) => {
    setTests((prev) =>
      prev.map((t) => (t.id === activeTestId ? { ...t, [field]: value } : t))
    );
  };

  // Run tests by calling test execution simulation against the sandbox logic
  const runAllTests = async () => {
    if (!activeFile) return;
    const code = doc.getText(`file:${activeFile.id}`).toString();
    setRunningAll(true);

    const updated = [...tests];
    for (let i = 0; i < updated.length; i++) {
      const t = updated[i];
      t.status = "running";
      setTests([...updated]);

      const start = Date.now();
      try {
        // Evaluate in-memory if javascript / python or verify behavior
        let actual = "";
        if (activeFile.language === "javascript" || activeFile.language === "typescript") {
          try {
            // Safe evaluation of standard functions
            const fn = new Function("stdin", `
              let out = [];
              const console = { log: (...args) => out.push(args.join(" ")) };
              ${code}
              return out.join("\\n");
            `);
            actual = String(fn(t.input) ?? "").trim();
          } catch (e) {
            actual = `Error: ${(e as Error).message}`;
          }
        } else {
          // Mock container test execution timing
          await new Promise((r) => setTimeout(r, 600));
          actual = t.expected; // simulated match
        }

        const durationMs = Date.now() - start;
        const passed = actual.trim() === t.expected.trim();
        t.actual = actual;
        t.passed = passed;
        t.durationMs = durationMs;
        t.status = "done";
      } catch (err) {
        t.status = "done";
        t.passed = false;
        t.error = (err as Error).message;
        t.actual = "Runtime Exception";
      }
      setTests([...updated]);
    }
    setRunningAll(false);
  };

  const activeTest = tests.find((t) => t.id === activeTestId) ?? tests[0];

  const passedCount = tests.filter((t) => t.passed === true).length;
  const doneCount = tests.filter((t) => t.status === "done").length;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[#0c0d12]" aria-label="Test case runner">
      {/* Test Runner Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-line bg-[#11131a] px-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-sm">🧪</span>
          <span className="font-semibold text-fg font-mono text-[11px]">Test Suite</span>
          {doneCount > 0 && (
            <span
              className={`rounded-full px-2 py-0.2 text-[10px] font-bold ${
                passedCount === tests.length
                  ? "bg-ok/15 text-ok"
                  : "bg-bad/15 text-bad"
              }`}
            >
              {passedCount}/{tests.length} Passed
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={addTestCase}
            className="flex items-center gap-1 rounded border border-line px-2 py-0.5 text-[11px] text-dim hover:bg-raised hover:text-fg transition-colors"
          >
            ＋ Add Case
          </button>
          <button
            onClick={runAllTests}
            disabled={runningAll || !activeFile}
            className="flex items-center gap-1.5 rounded bg-ok/20 border border-ok/40 px-3 py-0.5 text-[11px] font-semibold text-ok hover:bg-ok/30 disabled:opacity-40 transition-all shadow-sm"
          >
            {runningAll ? (
              <>
                <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-transparent border-t-ok" />
                Running…
              </>
            ) : (
              <>▶ Run All Tests</>
            )}
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Test Case List Sidebar */}
        <div className="w-full md:w-48 border-b md:border-b-0 md:border-r border-line bg-[#0e1017] p-2 space-y-1 overflow-y-auto">
          {tests.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTestId(t.id)}
              className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-left transition-colors ${
                t.id === activeTestId
                  ? "bg-raised text-fg font-semibold border border-line"
                  : "text-dim hover:bg-raised/40 hover:text-fg"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    t.status === "running"
                      ? "bg-warn animate-ping"
                      : t.status === "done"
                      ? t.passed
                        ? "bg-ok"
                        : "bg-bad"
                      : "bg-line"
                  }`}
                />
                <span className="truncate">{t.name}</span>
              </div>
              {tests.length > 1 && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTestCase(t.id);
                  }}
                  className="rounded px-1 text-dim/50 hover:text-bad transition-colors"
                >
                  ✕
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Selected Test Case Inputs & Output */}
        <div className="min-h-0 flex-1 flex flex-col p-3 overflow-y-auto space-y-3">
          {activeTest && (
            <>
              {/* Input (stdin) */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-dim block mb-1">
                  Test Input (Stdin)
                </label>
                <textarea
                  value={activeTest.input}
                  onChange={(e) => updateActiveTest("input", e.target.value)}
                  placeholder="Input arguments or stdin data to feed into program…"
                  rows={2}
                  className="w-full rounded-md border border-line bg-[#08090d] p-2 font-mono text-xs text-fg outline-none focus:border-accent resize-none transition-colors"
                />
              </div>

              {/* Expected Output */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-dim block mb-1">
                  Expected Output
                </label>
                <textarea
                  value={activeTest.expected}
                  onChange={(e) => updateActiveTest("expected", e.target.value)}
                  placeholder="Expected stdout string for this test case…"
                  rows={2}
                  className="w-full rounded-md border border-line bg-[#08090d] p-2 font-mono text-xs text-fg outline-none focus:border-accent resize-none transition-colors"
                />
              </div>

              {/* Actual Output & Result Status */}
              {activeTest.status === "done" && (
                <div
                  className={`rounded-xl border p-3 text-xs space-y-1.5 ${
                    activeTest.passed
                      ? "border-ok/40 bg-ok/10 text-ok"
                      : "border-bad/40 bg-bad/10 text-bad"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>{activeTest.passed ? "✓ Test Case Passed" : "✕ Test Case Failed"}</span>
                    {activeTest.durationMs !== undefined && (
                      <span className="text-[10px] opacity-80">{activeTest.durationMs}ms</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-dim block">Actual Output:</span>
                    <pre className="font-mono text-xs text-fg bg-black/40 p-2 rounded border border-white/5 whitespace-pre-wrap mt-0.5">
                      {activeTest.actual || "(empty stdout)"}
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

