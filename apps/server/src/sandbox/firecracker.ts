import type { ExecutionLimits } from "@sandbox/shared";
import type { ExecutionHandlers, ExecutionRequest, ExecutionResult, SandboxRuntime } from "./types";

/**
 * NOT IMPLEMENTED. Placeholder that documents the intended production design:
 *  1. Boot a Firecracker microVM from a pre-built rootfs snapshot (own kernel, no shared host kernel)
 *  2. Push code over vsock, run it under a guest agent
 *  3. Stream stdout/stderr back over vsock, enforce limits with cgroups + jailer + VM config
 *  4. Destroy the VM on exit
 */
export class FirecrackerRuntime implements SandboxRuntime {
  readonly name = "firecracker";
  readonly limits: ExecutionLimits = {
    runtime: "firecracker microVM (not implemented)",
    image: "n/a",
    timeoutMs: 0,
    memory: "n/a",
    cpus: "n/a",
    pids: 0,
    network: "disabled",
  };
  getLimits(_language?: string): ExecutionLimits {
    return this.limits;
  }
  execute(_r: ExecutionRequest, _h: ExecutionHandlers): Promise<ExecutionResult> {
    return Promise.reject(new Error("FirecrackerRuntime is not implemented"));
  }
  terminate(_id: string): Promise<void> {
    return Promise.reject(new Error("FirecrackerRuntime is not implemented"));
  }
  writeStdin(_executionId: string, _data: string): void {
    /* not implemented */
  }
}

