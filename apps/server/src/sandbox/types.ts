import type { ExecutionLimits, Language, SandboxStatus } from "@sandbox/shared";

export interface ExecutionFile {
  name: string;
  content: string;
}

export interface ExecutionRequest {
  executionId: string;
  language: string;
  /** Already validated (size, type) by the caller. Delivered to the sandbox via stdin or tmpfs. */
  code: string;
  /** Main file name (e.g. main.py, Main.java, main.cpp) */
  fileName?: string;
  /** All files in the room (for multi-file project execution) */
  files?: ExecutionFile[];
}

export interface ExecutionHandlers {
  onStatus(status: SandboxStatus): void;
  onStdout(data: string): void;
  onStderr(data: string): void;
}

export type ExecutionOutcome = "completed" | "timeout" | "failed" | "stopped";

export interface ExecutionResult {
  executionId: string;
  outcome: ExecutionOutcome;
  exitCode: number | null;
  durationMs: number;
  reason?: string;
}

/**
 * Generic isolation boundary. The MVP implements DockerRuntime (Linux containers,
 * shared host kernel). A FirecrackerRuntime (real microVM, own kernel) can be
 * dropped in behind the same interface without touching rooms/websocket code.
 */
export interface SandboxRuntime {
  readonly name: string;
  readonly limits: ExecutionLimits;
  getLimits(language?: string): ExecutionLimits;
  execute(request: ExecutionRequest, handlers: ExecutionHandlers): Promise<ExecutionResult>;
  terminate(executionId: string): Promise<void>;
  /** Forward user keystrokes to the running program's stdin (e.g. a readline prompt). No-op if not running. */
  writeStdin(executionId: string, data: string): void;
}
