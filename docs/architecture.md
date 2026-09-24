# Architecture

```
 Browser A ──┐                                   ┌─ Yjs Y.Doc (per room, in memory, source of truth)
             ├── WebSocket /ws ── Node/Fastify ──┤
 Browser B ──┘   (typed JSON)      rooms.ts      └─ execution.ts ── SandboxRuntime ── DockerRuntime
                                                                        │                 │
                                                          (future) FirecrackerRuntime     └─ ephemeral container
                                                                                              create → start(stdin=code) → stream → rm -f
```

## Collaboration
- `Y.Text("code")` per room. Each client edits a local Y.Doc; Monaco edits become fine-grained Y.Text insert/delete ops
  (`apps/web/lib/yMonaco.ts`), never whole-document replacement.
- Transport: Yjs binary updates, base64-encoded inside typed JSON `CRDT_UPDATE` messages. The server applies each update
  to its own Y.Doc (so late joiners receive full state via `SYNC_STATE`) and relays it to the others.
- Reconnect: the client re-joins, receives full state, merges it, and pushes its own full state back. CRDT merging makes
  this idempotent, so offline edits are not lost.
- Presence: server-tracked user list + cursor/selection offsets. Offsets are absolute, so a remote cursor can be off by a
  few characters during heavy concurrent typing (production: use Yjs relative positions / y-protocols awareness).
- Custom protocol instead of y-websocket: allows one socket to also carry presence and execution events with one typed schema.

## Execution
1. `RUN_CODE` → validate room membership, one run per room, global concurrency cap, source size ≤ 20k chars.
2. `docker create` with all isolation flags → `SANDBOX_STATUS CREATING`.
3. `docker start -a -i`, code piped through **stdin** (no mounts, no `docker cp`) → `RUNNING`; stdout/stderr streamed.
4. Timeout (5 s) / Stop / output cap (64 KB) → `docker kill`.
5. `docker rm -f` in a `finally` → `DESTROYED` → final `EXECUTION_*` event.

The Docker CLI is invoked with argument arrays (no shell). A Docker Engine API client (dockerode) would be equivalent;
the CLI was chosen to avoid a dependency and stream handling bugs within 12 hours.

## Technical challenges
- Binding Y.Text to Monaco without y-monaco (delta → offset → position edits, echo suppression).
- Guaranteeing cleanup on every path (timeout, stop, crash) via `finally` + `rm -f`.
- Keeping "what runs" trustworthy: the server executes its own CRDT copy.
- Stopping fork bombs / memory hogs with cgroup limits instead of trusting the code.

## Future improvements
Firecracker runtime (own kernel, jailer, vsock agent), warm pool of pre-booted microVMs, per-IP rate limiting,
authentication and room permissions, Redis pub/sub for horizontal WebSocket scaling, persistence, multi-file projects,
more languages, seccomp/gVisor for the Docker path, execution history.
