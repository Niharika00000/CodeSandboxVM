import { spawn } from "node:child_process";
import { type ExecutionLimits, isSupportedLanguage, LANGUAGE_REGISTRY } from "@sandbox/shared";
import { config, getImageForLanguage } from "../config";
import { log } from "../log";
import type {
  ExecutionHandlers,
  ExecutionOutcome,
  ExecutionRequest,
  ExecutionResult,
  SandboxRuntime,
} from "./types";

interface Running {
  name: string;
  stopRequested: boolean;
  kill: (reason: string) => void;
  write: (data: string) => void;
}

/** Runs a docker CLI command with an argv array (never a shell string -> no injection). */
function docker(args: string[], stdin?: string): Promise<{ code: number | null; out: string; err: string }> {
  return new Promise((resolve) => {
    const p = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    p.stdout.setEncoding("utf8").on("data", (d) => (out += d));
    p.stderr.setEncoding("utf8").on("data", (d) => (err += d));
    p.on("error", (e) => resolve({ code: -1, out, err: err + String(e) }));
    p.on("close", (code) => resolve({ code, out, err }));
    p.stdin.on("error", () => {});
    p.stdin.end(stdin ?? "");
  });
}

interface ExecutionPlan {
  image: string;
  targetFile: string;
  compile?: string[];
  run: string[];
}

function getExecutionPlan(language: string, reqFileName?: string): ExecutionPlan {
  const norm = language.toLowerCase();
  const reg = isSupportedLanguage(norm) ? LANGUAGE_REGISTRY[norm] : undefined;
  const image = getImageForLanguage(norm);
  const targetFile = reqFileName || (reg ? reg.defaultFileName : "main.txt");

  switch (norm) {
    case "typescript":
      return {
        image,
        targetFile,
        run: ["node", "--max-old-space-size=96", "--experimental-strip-types", `/tmp/${targetFile}`],
      };
    case "python":
      return {
        image,
        targetFile,
        run: ["python3", "-u", `/tmp/${targetFile}`],
      };
    case "c":
      return {
        image,
        targetFile,
        compile: ["gcc", "-O2", `/tmp/${targetFile}`, "-o", "/tmp/app", "-lm"],
        run: ["/tmp/app"],
      };
    case "cpp":
      return {
        image,
        targetFile,
        compile: ["g++", "-O2", `/tmp/${targetFile}`, "-o", "/tmp/app", "-lm"],
        run: ["/tmp/app"],
      };
    case "java": {
      const className = targetFile.replace(/\.java$/, "").split("/").pop() || "Main";
      return {
        image,
        targetFile,
        compile: ["javac", "-d", "/tmp", `/tmp/${targetFile}`],
        run: ["java", "-cp", "/tmp", className],
      };
    }
    case "go":
      return {
        image,
        targetFile,
        run: ["go", "run", `/tmp/${targetFile}`],
      };
    case "rust":
      return {
        image,
        targetFile,
        compile: ["rustc", "-O", `/tmp/${targetFile}`, "-o", "/tmp/app"],
        run: ["/tmp/app"],
      };
    case "shell":
      return {
        image,
        targetFile,
        run: ["bash", `/tmp/${targetFile}`],
      };
    case "ruby":
      return {
        image,
        targetFile,
        run: ["ruby", `/tmp/${targetFile}`],
      };
    case "php":
      return {
        image,
        targetFile,
        run: ["php", `/tmp/${targetFile}`],
      };
    case "javascript":
    default:
      return {
        image,
        targetFile,
        run: ["node", "--max-old-space-size=96", `/tmp/${targetFile}`],
      };
  }
}

async function executeHostFallback(
  req: ExecutionRequest,
  h: ExecutionHandlers,
  done: (outcome: ExecutionOutcome, exitCode: number | null, reason?: string) => ExecutionResult,
  plan: ExecutionPlan
): Promise<ExecutionResult> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const os = await import("node:os");

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sbx-"));
  h.onStatus("RUNNING");
  h.onStdout("\x1b[36m⚡ [Host Fallback: Docker not installed on host — executing directly]\x1b[0m\r\n");

  try {
    const filesToWrite = req.files && req.files.length > 0
      ? req.files
      : [{ name: plan.targetFile, content: req.code }];

    for (const f of filesToWrite) {
      const safeName = f.name.replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
      const fullPath = path.join(tmpDir, safeName);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, f.content, "utf8");
    }

    const norm = req.language.toLowerCase();
    let cmd = "";
    let args: string[] = [];
    const targetPath = path.join(tmpDir, plan.targetFile);

    if (norm === "python") {
      cmd = process.platform === "win32" ? "python" : "python3";
      args = ["-u", targetPath];
    } else if (norm === "javascript") {
      cmd = "node";
      args = [targetPath];
    } else if (norm === "typescript") {
      cmd = "node";
      args = ["--experimental-strip-types", targetPath];
    } else if (norm === "shell" || norm === "bash") {
      cmd = process.platform === "win32" ? "bash" : "sh";
      args = [targetPath];
    } else {
      h.onStderr(`\r\n[Host Fallback] Language "${req.language}" requires Docker or local compiler installed.\r\n`);
      return done("failed", 1, `Language ${req.language} requires Docker`);
    }

    return await new Promise<ExecutionResult>((resolve) => {
      let outputBytes = 0;
      let timer: NodeJS.Timeout | undefined;

      const p = spawn(cmd, args, { cwd: tmpDir });

      timer = setTimeout(() => {
        try { p.kill("SIGKILL"); } catch {}
        h.onStderr("\r\n[Execution timed out (5s)]\r\n");
        resolve(done("timeout", null, "Execution timeout"));
      }, config.timeoutMs);

      p.stdout?.on("data", (chunk: Buffer) => {
        outputBytes += chunk.length;
        if (outputBytes <= config.maxOutputBytes) {
          h.onStdout(chunk.toString("utf8"));
        }
      });

      p.stderr?.on("data", (chunk: Buffer) => {
        outputBytes += chunk.length;
        if (outputBytes <= config.maxOutputBytes) {
          h.onStderr(chunk.toString("utf8"));
        }
      });

      p.on("error", (err) => {
        clearTimeout(timer);
        h.onStderr(`\r\n[Host Fallback Error] Could not run ${cmd}: ${err.message}\r\n`);
        resolve(done("failed", 1, err.message));
      });

      p.on("close", (code) => {
        clearTimeout(timer);
        h.onStatus("DESTROYED");
        resolve(done("completed", code));
      });
    });
  } catch (err: any) {
    return done("failed", 1, err?.message ?? "Host fallback failed");
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

/**
 * Multi-language sandbox runtime: one fresh Docker container per execution.
 * Dispatches to the appropriate language toolchain, compiles if required,
 * streams real-time stdout/stderr, and supports interactive stdin.
 */
export class DockerRuntime implements SandboxRuntime {
  readonly name = "docker";
  readonly limits: ExecutionLimits = {
    runtime: "docker container (shared kernel - not a microVM)",
    image: config.image,
    timeoutMs: config.timeoutMs,
    memory: config.memory,
    cpus: config.cpus,
    pids: config.pids,
    network: "disabled",
  };
  private running = new Map<string, Running>();

  getLimits(language?: string): ExecutionLimits {
    const img = language ? getImageForLanguage(language) : config.image;
    return {
      ...this.limits,
      image: img,
    };
  }

  async execute(req: ExecutionRequest, h: ExecutionHandlers): Promise<ExecutionResult> {
    const started = Date.now();
    const name = `sbx_${req.executionId}`; // executionId is server-generated hex
    const done = (outcome: ExecutionOutcome, exitCode: number | null, reason?: string): ExecutionResult => ({
      executionId: req.executionId,
      outcome,
      exitCode,
      durationMs: Date.now() - started,
      reason,
    });

    const plan = getExecutionPlan(req.language, req.fileName);

    h.onStatus("CREATING");
    // 1. CREATE (not started yet). All isolation controls are set here.
    const create = await docker([
      "create",
      "--name", name,
      "--network", "none",                       // no network at all
      "--memory", config.memory,
      "--memory-swap", config.memory,            // no swap: hard memory ceiling
      "--cpus", config.cpus,
      "--pids-limit", String(config.pids),       // fork-bomb protection
      "--read-only",                             // immutable root filesystem
      "--tmpfs", "/tmp:rw,exec,nosuid,size=64m", // writable and executable tmpfs
      "--cap-drop", "ALL",                       // no Linux capabilities
      "--security-opt", "no-new-privileges",
      "--user", "65534:65534",                   // nobody, non-root
      "--ulimit", "nofile=256:256",
      "--label", "collab-sandbox=1",
      "--env", "HOME=/tmp",
      "--env", "TMPDIR=/tmp",
      "--env", "PYTHONUNBUFFERED=1",
      "--env", "PYTHONPYCACHEPREFIX=/tmp/pycache",
      "--env", "GOCACHE=/tmp/gocache",
      "--env", "GOPATH=/tmp/go",
      plan.image,
      "tail", "-f", "/dev/null",                 // idle; real work happens via `docker exec`
    ]);
    if (create.code !== 0) {
      if (create.err.includes("ENOENT") || create.err.includes("not found") || create.err.includes("not recognized") || create.code === -1) {
        log("DOCKER", `Docker not available (${create.err.trim()}), using host fallback for ${req.executionId}`);
        return executeHostFallback(req, h, done, plan);
      }
      log("DOCKER", `create failed for ${req.executionId} (image=${plan.image})`);
      const detail = create.err.trim().split("\n").pop() ?? "unknown";
      return done("failed", null, `Sandbox creation failed with ${plan.image}: ${detail}`);
    }
    const start0 = await docker(["start", name]);
    if (start0.code !== 0) {
      await docker(["rm", "-f", name]);
      return done("failed", null, "Sandbox failed to start");
    }
    log("DOCKER", `Container created ${name} (lang=${req.language}, image=${plan.image})`);

    let outcome = "completed" as ExecutionOutcome;
    let reason: string | undefined;
    let outputBytes = 0;
    let exitCode: number | null = null;

    try {
      // 2. Copy source file(s) into the container's tmpfs.
      const filesToWrite = req.files && req.files.length > 0
        ? req.files
        : [{ name: plan.targetFile, content: req.code }];

      for (const f of filesToWrite) {
        const safeName = f.name.replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
        const targetPath = `/tmp/${safeName}`;
        const dir = safeName.includes("/") ? `/tmp/${safeName.substring(0, safeName.lastIndexOf("/"))}` : "";
        const shCmd = dir ? `mkdir -p '${dir}' && cat > '${targetPath}'` : `cat > '${targetPath}'`;
        const write = spawn("docker", ["exec", "-i", name, "sh", "-c", shCmd], { stdio: ["pipe", "pipe", "pipe"] });
        await new Promise<void>((resolve) => {
          write.stdin.on("error", () => {});
          write.stdin.end(f.content);
          write.on("close", () => resolve());
          write.on("error", () => resolve());
        });
      }

      // 3. Compile if required (e.g. C, C++, Rust, Java).
      if (plan.compile) {
        h.onStatus("COMPILING");
        log("DOCKER", `Compiling ${plan.targetFile} for ${req.executionId}`);
        const comp = spawn("docker", ["exec", name, ...plan.compile], { stdio: ["pipe", "pipe", "pipe"] });
        let compErr = "";
        comp.stdout.setEncoding("utf8").on("data", (d: string) => h.onStdout(d));
        comp.stderr.setEncoding("utf8").on("data", (d: string) => {
          compErr += d;
          h.onStderr(d);
        });
        const compCode = await new Promise<number | null>((resolve) => {
          comp.on("close", (c) => resolve(c));
          comp.on("error", () => resolve(-1));
        });
        if (compCode !== 0) {
          log("DOCKER", `Compilation failed for ${req.executionId} (exit ${compCode})`);
          return done("failed", compCode, compErr.trim().split("\n")[0] || "Compilation error");
        }
      }

      // 4. Run attached, with its OWN fresh stdin left open for interactive input.
      const child = spawn("docker", ["exec", "-i", name, ...plan.run], { stdio: ["pipe", "pipe", "pipe"] });
      const entry: Running = {
        name,
        stopRequested: false,
        kill: (r) => {
          if (outcome === "completed") {
            outcome = r === "STOPPED" ? "stopped" : r === "TIMEOUT" ? "timeout" : "failed";
            reason = r;
          }
          void docker(["kill", name]);
        },
        write: (data) => { try { child.stdin.write(data); } catch { /* process already exited */ } },
      };
      this.running.set(req.executionId, entry);
      h.onStatus("RUNNING");
      log("DOCKER", `Container started ${name} (${plan.run.join(" ")})`);

      const timer = setTimeout(() => entry.kill("TIMEOUT"), config.timeoutMs);

      const cap = (chunk: string, emit: (s: string) => void) => {
        outputBytes += Buffer.byteLength(chunk);
        if (outputBytes > config.maxOutputBytes) {
          entry.kill("OUTPUT_LIMIT");
          return;
        }
        emit(chunk);
      };
      child.stdout.setEncoding("utf8").on("data", (d: string) => cap(d, h.onStdout));
      child.stderr.setEncoding("utf8").on("data", (d: string) => cap(d, h.onStderr));
      child.stdin.on("error", () => {});

      exitCode = await new Promise<number | null>((resolve) => {
        child.on("error", () => resolve(null));
        child.on("close", (c) => resolve(c));
      });
      clearTimeout(timer);
    } finally {
      // 5. DESTROY, always
      this.running.delete(req.executionId);
      const rm = await docker(["rm", "-f", name]);
      if (rm.code === 0) log("DOCKER", `Container destroyed ${name}`);
      else log("DOCKER", `WARNING: failed to destroy ${name}`);
      h.onStatus("DESTROYED");
    }

    if (outcome === "completed" && exitCode !== 0) {
      // non-zero exit from user program (e.g. uncaught exception) is still a finished run
      return done("completed", exitCode);
    }
    return done(outcome, exitCode, reason);
  }

  async terminate(executionId: string): Promise<void> {
    const r = this.running.get(executionId);
    if (r) r.kill("STOPPED");
  }

  writeStdin(executionId: string, data: string): void {
    this.running.get(executionId)?.write(data);
  }
}

