# SandboxRoom - Collaborative Code Sandbox (Yjs CRDT + WebSockets + Docker isolation)

Multiple people edit one JavaScript file in real time (Monaco + Yjs), press **Run**, and the code executes in a
fresh, network-less, resource-limited Docker container that is destroyed afterwards. Output streams live to
everyone in the room.

> **Honesty box.** This is a hackathon MVP. Execution uses **Docker containers, which are NOT microVMs** and share the
> host kernel. The code is structured behind a `SandboxRuntime` interface so a Firecracker microVM runtime can replace
> it, but `FirecrackerRuntime` is only a documented stub. Do not claim this is production-secure.

## What was actually verified

| Area | Status |
|---|---|
| Server + web typecheck (`npm run typecheck`) and `next build` | Verified |
| Yjs sync over WebSocket, concurrent-edit convergence, malformed message / bad room ID / foreign-Origin rejection (`npm run test:collab`) | Verified (9/9 pass) |
| Run path fails gracefully when Docker is missing | Verified |
| **Docker execution, limits, timeout, cleanup** (`npm run test:sandbox`) | **Written, not run by the author (no Docker in the build environment). Run it on your machine first.** |
| Browser UI in two real browser windows | **Not verified visually.** Compiles; follow the demo steps to check. |

## Prerequisites
- Node.js 20+ (built on 22), npm 9+
- Docker Desktop / Docker Engine running, and your user able to run `docker` without sudo
- Internet on first load (Monaco is fetched from a CDN by `@monaco-editor/react`; pre-load the page once before a demo on bad Wi-Fi)

## Run it
```bash
cp .env.example .env          # optional; defaults work. Server reads process env, so also: export $(grep -v '^#' .env | xargs)
npm install
npm run docker:pull           # pulls node:22-alpine once
npm run dev                   # server :4000 + web :3000
```
Open http://localhost:3000 -> **Create a room** -> copy the link -> open it in a second window (use a private window or
another browser) -> enter different names.

For the web app, put `NEXT_PUBLIC_*` vars in `apps/web/.env.local` if you change ports.

## Tests
```bash
npm run dev -w @sandbox/server   # terminal 1
npm run test:collab              # CRDT convergence + input validation (no Docker needed)
npm run test:sandbox             # needs Docker: hello, stderr, infinite loop, no network, read-only fs, non-root,
                                 # memory hog, fork bomb, output flood
```

## Structure (and why)
```
apps/server/src
  index.ts            Fastify REST + wiring (choose the runtime here)
  websocket.ts        ws server: origin check, zod validation, flood control, Yjs relay, run/stop
  rooms.ts            in-memory rooms (Y.Doc per room), presence, TTL cleanup
  execution.ts        validation + lifecycle; reads code from the server's CRDT copy
  sandbox/types.ts    SandboxRuntime interface
  sandbox/docker.ts   DockerRuntime (implemented)
  sandbox/firecracker.ts  FirecrackerRuntime (stub)
apps/web              Next.js + Tailwind + Monaco UI, useRoom hook, custom Y.Text<->Monaco binding
packages/shared       Typed WebSocket protocol + zod schemas + limits, used by both sides
docs/                 architecture.md, security.md, demo.md
```
Simplifications vs. the suggested layout: no separate `api/`, `docker/`, `utils/` folders (they would each hold one small
file), and no database or Redis (rooms are ephemeral by design; state is lost on server restart).

## REST API
| Method | Path | Result |
|---|---|---|
| POST | `/api/rooms` | `{ roomId, url }` (10-char random ID; 503 if too many rooms) |
| GET | `/api/rooms/:id` | `{ roomId, users }`, 400 invalid id, 404 unknown |
| GET | `/api/health` | `{ ok, rooms, runtime }` |

## WebSocket protocol (`ws://localhost:4000/ws`, JSON text frames, types in `packages/shared/src/protocol.ts`)
Client -> server: `JOIN_ROOM {roomId,name}`, `LEAVE_ROOM`, `CRDT_UPDATE {update(base64)}`, `CURSOR_UPDATE {anchor,head}`,
`RUN_CODE {language}`, `STOP_CODE`. Every message is validated with zod; anything else gets an `ERROR`.

Server -> client: `SYNC_STATE {update,you,users}`, `CRDT_UPDATE`, `USER_JOINED`, `USER_LEFT`, `CURSOR_UPDATE`,
`EXECUTION_STARTED {executionId,limits}`, `SANDBOX_STATUS {CREATING|RUNNING|DESTROYED...}`, `STDOUT`, `STDERR`,
`EXECUTION_COMPLETED {exitCode,durationMs}`, `EXECUTION_TIMEOUT`, `EXECUTION_FAILED {reason}`, `ERROR {code,message}`.

`RUN_CODE` deliberately carries **no source code**: the server runs its own CRDT copy, so the browser cannot submit
arbitrary size/language/params.

## Configuration
See `.env.example`. Limits default to: 5 s, 128 MB (no swap), 0.5 CPU, 64 PIDs, 64 KB output, 3 concurrent runs, 100 rooms.

## Docs
`docs/architecture.md` (diagram, data flow, design choices, challenges, future work), `docs/security.md` (threat model),
`docs/demo.md` (demo script + interview explanation).

