import { randomBytes } from "node:crypto";
import { type FileMeta, isRunnableLanguage, LIMITS, SUPPORTED_LANGUAGES } from "@sandbox/shared";
import { config } from "./config";
import { log } from "./log";
import { broadcast, MAIN_FILE_ID, type Room } from "./rooms";
import type { SandboxRuntime } from "./sandbox/types";

let globalActive = 0;

/** Validates, then runs the room's CURRENT CRDT text (for the given file) in the sandbox and streams events to the room. */
export async function runRoomCode(room: Room, runtime: SandboxRuntime, startedBy: string, fileId = MAIN_FILE_ID): Promise<string | null> {
  if (room.activeExecutionId) return "An execution is already running in this room.";
  if (globalActive >= config.maxConcurrentExecutions) return "Server is busy. Try again in a few seconds.";

  const filesMap = room.doc.getMap<FileMeta>("files");
  if (!filesMap.has(fileId)) return "That file no longer exists.";
  const fileMeta = filesMap.get(fileId);
  const lang = (fileMeta?.language || "javascript").toLowerCase();

  if (!isRunnableLanguage(lang)) {
    return `Cannot execute "${fileMeta?.name ?? fileId}": "${lang}" is not an executable programming language. Supported languages: ${SUPPORTED_LANGUAGES.join(", ")}`;
  }

  // Source of truth is the server-side CRDT, never a string supplied by the browser.
  const code = room.doc.getText(`file:${fileId}`).toString();
  if (code.length === 0) return "Editor is empty.";
  if (code.length > LIMITS.MAX_SOURCE_CHARS) return `Source too large (max ${LIMITS.MAX_SOURCE_CHARS} characters).`;

  // Collect all files in the room for multi-file support / imports
  const allFiles: { name: string; content: string }[] = [];
  for (const [id, meta] of filesMap.entries()) {
    allFiles.push({
      name: meta.name,
      content: room.doc.getText(`file:${id}`).toString(),
    });
  }

  const executionId = `exec_${randomBytes(6).toString("hex")}`;
  room.activeExecutionId = executionId;
  globalActive++;
  log("EXECUTION", `Started ${executionId} in ${room.id} (lang=${lang}, file=${fileMeta?.name})`);

  const limits = runtime.getLimits ? runtime.getLimits(lang) : runtime.limits;
  broadcast(room, { type: "EXECUTION_STARTED", executionId, startedBy, limits });

  // Fire and forget: results arrive as WebSocket events.
  void (async () => {
    try {
      const r = await runtime.execute(
        { executionId, language: lang, code, fileName: fileMeta?.name, files: allFiles },
        {
          onStatus: (status) => broadcast(room, { type: "SANDBOX_STATUS", executionId, status }),
          onStdout: (data) => broadcast(room, { type: "STDOUT", executionId, data }),
          onStderr: (data) => broadcast(room, { type: "STDERR", executionId, data }),
        },
      );
      log("EXECUTION", `${r.outcome} ${executionId} exit=${r.exitCode} ${r.durationMs}ms`);
      if (r.outcome === "timeout") broadcast(room, { type: "EXECUTION_TIMEOUT", executionId, durationMs: r.durationMs });
      else if (r.outcome === "failed" || r.outcome === "stopped")
        broadcast(room, { type: "EXECUTION_FAILED", executionId, reason: r.reason ?? r.outcome, durationMs: r.durationMs });
      else broadcast(room, { type: "EXECUTION_COMPLETED", executionId, exitCode: r.exitCode ?? -1, durationMs: r.durationMs });
    } catch (e) {
      log("EXECUTION", `Error ${executionId}: ${(e as Error).message}`);
      broadcast(room, { type: "EXECUTION_FAILED", executionId, reason: "Internal execution error", durationMs: 0 });
    } finally {
      globalActive--;
      room.activeExecutionId = undefined;
    }
  })();
  return null;
}
