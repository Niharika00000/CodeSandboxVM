import Fastify from "fastify";
import cors from "@fastify/cors";
import { ROOM_ID_REGEX } from "@sandbox/shared";
import { completeCode, reviewCode, explainError, chatWithAi } from "./ai";
import { config } from "./config";
import { log } from "./log";
import { createRoom, getRoom, roomCount } from "./rooms";
import { DockerRuntime } from "./sandbox/docker";
import type { SandboxRuntime } from "./sandbox/types";
import { attachWebSocket } from "./websocket";
import { spawnSync } from "node:child_process";

// Swap this line for `new FirecrackerRuntime()` once implemented.
const runtime: SandboxRuntime = new DockerRuntime();

const app = Fastify({ logger: false, bodyLimit: 1024 });
await app.register(cors, { origin: config.webOrigin, methods: ["GET", "POST"] });

app.get("/api/health", async () => ({ ok: true, rooms: roomCount(), runtime: runtime.name }));

app.post<{ Body: { language?: string } }>("/api/rooms", async (req, reply) => {
  const language = req.body?.language;
  const room = createRoom(language);
  if (!room) return reply.code(503).send({ error: "Too many active rooms" });
  return { roomId: room.id, url: `${config.publicWebUrl}/room/${room.id}` };
});

app.get<{ Params: { id: string } }>("/api/rooms/:id", async (req, reply) => {
  if (!ROOM_ID_REGEX.test(req.params.id)) return reply.code(400).send({ error: "Invalid room id" });
  const room = getRoom(req.params.id);
  if (!room) return reply.code(404).send({ error: "Room not found" });
  return { roomId: room.id, users: room.clients.size };
});

// Simple global rate limit for the AI route (it costs real money per call).
let aiWindowStart = Date.now();
let aiCount = 0;

app.post<{ Body: { code?: string; language?: string; filename?: string } }>(
  "/api/ai/review",
  { bodyLimit: 128 * 1024 },
  async (req, reply) => {
    const now = Date.now();
    if (now - aiWindowStart > 10_000) { aiWindowStart = now; aiCount = 0; }
    if (++aiCount > 10) return reply.code(429).send({ error: "Too many AI requests, slow down." });

    const { code = "", language = "javascript", filename = "untitled" } = req.body ?? {};
    if (typeof code !== "string" || code.trim().length === 0)
      return reply.code(400).send({ error: "code is required" });
    try {
      const result = await reviewCode(code, String(language), String(filename));
      return result;
    } catch (e) {
      log("AI", `review failed: ${(e as Error).message}`);
      return reply.code(502).send({ error: (e as Error).message });
    }
  },
);

app.post<{ Body: { prefix?: string; suffix?: string; language?: string } }>(
  "/api/ai/complete",
  { bodyLimit: 64 * 1024 },
  async (req, reply) => {
    const now = Date.now();
    if (now - aiWindowStart > 10_000) { aiWindowStart = now; aiCount = 0; }
    if (++aiCount > 20) return reply.code(429).send({ error: "Too many AI requests, slow down." });

    const { prefix = "", suffix = "", language = "javascript" } = req.body ?? {};
    if (typeof prefix !== "string" || typeof suffix !== "string") return reply.code(400).send({ error: "Invalid body" });
    try {
      const suggestion = await completeCode({ prefix, suffix, language: String(language) });
      return { suggestion };
    } catch (e) {
      log("AI", `completion failed: ${(e as Error).message}`);
      return reply.code(502).send({ error: (e as Error).message });
    }
  },
);

app.post<{ Body: { code?: string; error?: string; language?: string } }>(
  "/api/ai/explain",
  { bodyLimit: 64 * 1024 },
  async (req, reply) => {
    const { code = "", error = "", language = "javascript" } = req.body ?? {};
    if (!error) return reply.code(400).send({ error: "error output is required" });
    try {
      const result = await explainError(String(code), String(error), String(language));
      return result;
    } catch (e) {
      log("AI", `explain failed: ${(e as Error).message}`);
      return reply.code(502).send({ error: (e as Error).message });
    }
  },
);

app.post<{ Body: { messages: { role: "user" | "assistant" | "system"; content: string }[]; code?: string; language?: string; filename?: string } }>(
  "/api/ai/chat",
  { bodyLimit: 128 * 1024 },
  async (req, reply) => {
    const { messages = [], code = "", language = "javascript", filename = "file" } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return reply.code(400).send({ error: "messages array is required" });
    }
    try {
      const result = await chatWithAi(messages, { code, language, filename });
      return result;
    } catch (e) {
      log("AI", `chat failed: ${(e as Error).message}`);
      return reply.code(502).send({ error: (e as Error).message });
    }
  },
);



attachWebSocket(app.server, runtime);
await app.listen({ port: config.port, host: config.host });
log("SERVER", `Listening on http://${config.host}:${config.port} (runtime=${runtime.name})`);

const info = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8" });
if (info.status === 0) log("DOCKER", `Docker daemon reachable (v${info.stdout.trim()}). Image: ${config.image}`);
else log("DOCKER", "WARNING: Docker daemon not reachable. Editing works, Run will fail. Start Docker Desktop / dockerd.");

