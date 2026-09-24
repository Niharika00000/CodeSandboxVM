# Demo script (about 4 minutes)

Before: `npm run docker:pull`, `npm run dev`, load the app once (Monaco CDN), open two windows side by side.

1. **Create room** in window A, copy link, open it in window B. Show the Room ID, 2 users online, "Connected".
2. **CRDT**: type in A and B at the same time (also at the same spot); both converge. Show remote cursors/names.
   Say: "Each keystroke is a Yjs operation, not the whole file. No central conflict logic."
3. **Run** the default code. Terminal streams output; the Sandbox panel walks Creating → Running → Completed → Destroyed,
   with Execution ID, memory 128m, CPU 0.5, Network Disabled. Optionally `docker ps -a` in a terminal: nothing left behind.
4. **Timeout**: replace the code with `while (true) {}` → after 5 s: "EXECUTION TERMINATED, Reason: TIMEOUT", sandbox destroyed.
5. **No network**: `fetch("https://example.com").catch(e => console.log("blocked:", e.cause?.code))`.
6. **Errors**: `console.log(x)` → red `ReferenceError` in stderr.
7. **Memory/fork bomb** (optional): `const a=[];while(true)a.push(Buffer.alloc(1e7,1))` → killed.
8. Logs: show server terminal `[ROOM] [EXECUTION] [DOCKER] Container created/destroyed`.

## Interview answers
- **Why CRDT?** Concurrent edits conflict; Yjs makes operations commutative so replicas converge without a central resolver.
- **Why WebSockets?** Low-latency bidirectional: edits, presence and live stdout share one connection.
- **Why sandbox / ephemeral?** User code is hostile by default; a fresh environment per run leaves nothing to persist or leak.
- **Why limits?** Bound CPU, memory, processes, time, output so one run cannot starve the host.
- **Why the abstraction?** Docker now; Firecracker later without touching room/WebSocket code.
- **Is Docker a microVM?** No. Containers share the host kernel; that is the main weakness we call out.
- **What would you change for production?** Firecracker/gVisor, auth, rate limits, a pool of pre-warmed sandboxes, Redis for scaling.

