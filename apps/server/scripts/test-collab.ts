// Run with the server up: npm run dev -w @sandbox/server   then: npm run test:collab
import WebSocket from "ws";
import * as Y from "yjs";

const API = process.env.API ?? "http://localhost:4000";
const WS = process.env.WS ?? "ws://localhost:4000/ws";
const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");
const un = (s: string) => new Uint8Array(Buffer.from(s, "base64"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) failed++; };

async function client(roomId: string, name: string) {
  const doc = new Y.Doc();
  const ws = new WebSocket(WS, { headers: { origin: "http://localhost:3000" } });
  const errors: string[] = [];
  await new Promise((r) => ws.on("open", r));
  ws.on("message", (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.type === "SYNC_STATE" || m.type === "CRDT_UPDATE") Y.applyUpdate(doc, un(m.update), "remote");
    if (m.type === "ERROR") errors.push(m.code);
  });
  doc.on("update", (u: Uint8Array, origin: unknown) => {
    if (origin !== "remote") ws.send(JSON.stringify({ type: "CRDT_UPDATE", update: b64(u) }));
  });
  ws.send(JSON.stringify({ type: "JOIN_ROOM", roomId, name }));
  await sleep(200);
  return { doc, ws, errors, text: () => doc.getText("code").toString() };
}

const res = await fetch(`${API}/api/rooms`, { method: "POST" });
const { roomId } = (await res.json()) as { roomId: string };
console.log("room", roomId);

const a = await client(roomId, "Alice");
const b = await client(roomId, "Bob");
check("both clients receive the initial document", a.text().length > 0 && a.text() === b.text());

// Concurrent edits: A inserts at start, B inserts at end, at the same moment
a.doc.getText("code").insert(0, "// A was here\n");
b.doc.getText("code").insert(b.text().length, "// B was here\n");
await sleep(300);
check("concurrent edits converge to identical text", a.text() === b.text());
check("no edit was lost", a.text().includes("// A was here") && a.text().includes("// B was here"));

// Concurrent edits at the SAME position
a.doc.getText("code").insert(0, "X");
b.doc.getText("code").insert(0, "Y");
await sleep(300);
check("same-position inserts converge", a.text() === b.text() && a.text().includes("X") && a.text().includes("Y"));

// Security: bad inputs
const bad = await client(roomId, "Mallory");
bad.ws.send("not json");
bad.ws.send(JSON.stringify({ type: "DROP_TABLES" }));
bad.ws.send(JSON.stringify({ type: "CRDT_UPDATE", update: "AAAA" }));
await sleep(300);
check("malformed messages are rejected, socket survives", bad.errors.length >= 2);
const badJoin = await client("../../etc/passwd", "x");
check("invalid room id is rejected", badJoin.errors.includes("BAD_MESSAGE"));
const ghost = await client("abcdefgh12", "x");
check("unknown room is rejected", ghost.errors.includes("ROOM_NOT_FOUND"));
const r404 = await fetch(`${API}/api/rooms/../../etc`);
check("room id validation on REST", r404.status === 400 || r404.status === 404);
const evil = new WebSocket(WS, { headers: { origin: "http://evil.example" } });
const evilResult = await new Promise((r) => { evil.on("open", () => r("open")); evil.on("error", () => r("blocked")); evil.on("close", () => r("blocked")); });
check("foreign Origin is rejected", evilResult === "blocked");

for (const c of [a, b, bad]) c.ws.close();
console.log(failed ? `\n${failed} FAILED` : "\nAll collaboration tests passed");
process.exit(failed ? 1 : 0);
