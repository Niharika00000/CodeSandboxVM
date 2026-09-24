import { LANGUAGE_REGISTRY, isSupportedLanguage } from "@sandbox/shared";

// Automatically load .env if available in Node 20+
try {
  process.loadEnvFile?.();
} catch {}
try {
  process.loadEnvFile?.("../../.env");
} catch {}

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

// Resilient chat model selection
const getAiModel = () => {
  const m = process.env.NVIDIA_MODEL;
  if (!m || m.includes("kumo-relational")) {
    return "meta/llama-3.1-8b-instruct";
  }
  return m;
};

export const config = {
  port: num(process.env.PORT, 4000),
  host: process.env.HOST ?? "127.0.0.1",
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  publicWebUrl: process.env.PUBLIC_WEB_URL ?? "http://localhost:3000",
  image: process.env.SANDBOX_IMAGE ?? "node:22-alpine",
  timeoutMs: num(process.env.EXEC_TIMEOUT_MS, 5000),
  memory: process.env.EXEC_MEMORY ?? "128m",
  cpus: process.env.EXEC_CPUS ?? "0.5",
  pids: num(process.env.EXEC_PIDS, 64),
  maxConcurrentExecutions: num(process.env.MAX_CONCURRENT_EXECUTIONS, 3),
  maxRooms: num(process.env.MAX_ROOMS, 100),
  maxOutputBytes: 64 * 1024,
  emptyRoomTtlMs: 10 * 60 * 1000,

  // AI code-completion (NVIDIA NIM, OpenAI-compatible /chat/completions API).
  // The key lives only on the server - it is never sent to the browser.
  nvidiaApiKey: process.env.NVIDIA_API_KEY ?? "",
  nvidiaBaseUrl: process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
  nvidiaModel: getAiModel(),
  aiMaxPromptChars: 8_000,
  aiTimeoutMs: 10_000,
} as const;

export function getImageForLanguage(language: string): string {
  const norm = language.toLowerCase();
  const envKey = `SANDBOX_IMAGE_${norm.toUpperCase()}`;
  if (process.env[envKey]) {
    return process.env[envKey]!;
  }
  // If SANDBOX_IMAGE is explicitly customized (different from default node:22-alpine),
  // or if the language is javascript/typescript, honor SANDBOX_IMAGE.
  if (process.env.SANDBOX_IMAGE && (process.env.SANDBOX_IMAGE !== "node:22-alpine" || norm === "javascript" || norm === "typescript")) {
    return process.env.SANDBOX_IMAGE;
  }
  if (isSupportedLanguage(norm)) {
    return LANGUAGE_REGISTRY[norm].defaultImage;
  }
  return config.image;
}

