import type { IncomingMessage } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import * as Y from "yjs";
import { randomBytes } from "node:crypto";
import { ClientMessageSchema, LIMITS, type ChatEntry } from "@sandbox/shared";
import { config } from "./config";
import { log } from "./log";
import { runRoomCode } from "./execution";
import { addChatEntry, addClient, broadcast, getRoom, removeClient, send, type Client, type Room } from "./rooms";
import type { SandboxRuntime } from "./sandbox/types";

const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");
const fromB64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

export function attachWebSocket(server: import("node:http").Server, runtime: SandboxRuntime) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: LIMITS.MAX_WS_PAYLOAD_BYTES });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url ?? "/", "http://x");
    // Origin check: blocks other websites from opening sockets with a visitor's browser.
    const origin = req.headers.origin;
    if (url.pathname !== "/ws" || (origin && origin !== config.webOrigin)) {
      log("SECURITY", `Rejected upgrade (path=${url.pathname}, origin=${origin ?? "none"})`);
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
  });

  wss.on("connection", (ws: WebSocket) => {
    let room: Room | undefined;
    let client: Client | undefined;
    const joinTimer = setTimeout(() => { if (!client) ws.close(4001, "join timeout"); }, 10_000);

    // Simple per-connection flood control: 200 messages / 10s
    let windowStart = Date.now();
    let count = 0;

    ws.on("message", (raw, isBinary) => {
      if (isBinary) return send(ws, { type: "ERROR", code: "BAD_MESSAGE", message: "Binary frames not supported" });
      const now = Date.now();
      if (now - windowStart > 10_000) { windowStart = now; count = 0; }
      if (++count > 200) { log("SECURITY", "Flood, closing socket"); return ws.close(4008, "rate limit"); }

      let parsed;
      try {
        parsed = ClientMessageSchema.safeParse(JSON.parse(raw.toString()));
      } catch {
        return send(ws, { type: "ERROR", code: "BAD_JSON", message: "Invalid JSON" });
      }
      if (!parsed.success) return send(ws, { type: "ERROR", code: "BAD_MESSAGE", message: "Invalid message" });
      const msg = parsed.data;

      if (msg.type === "JOIN_ROOM") {
        if (client) return send(ws, { type: "ERROR", code: "ALREADY_JOINED", message: "Already in a room" });
        const r = getRoom(msg.roomId);
        if (!r) { send(ws, { type: "ERROR", code: "ROOM_NOT_FOUND", message: "Room does not exist or expired" }); return ws.close(4004, "no room"); }
        const c = addClient(r, ws, msg.name);
        if (!c) { send(ws, { type: "ERROR", code: "ROOM_FULL", message: "Room is full" }); return ws.close(4003, "full"); }
        clearTimeout(joinTimer);
        room = r; client = c;
        send(ws, {
          type: "SYNC_STATE",
          update: b64(Y.encodeStateAsUpdate(r.doc)),
          you: c.user,
          users: [...r.clients.values()].map((x) => x.user),
          chatHistory: r.chat,
        });
        broadcast(r, { type: "USER_JOINED", user: c.user }, c.user.id);
        return;
      }

      if (!room || !client) return send(ws, { type: "ERROR", code: "NOT_JOINED", message: "Join a room first" });

      switch (msg.type) {
        case "LEAVE_ROOM":
          removeClient(room, client.user.id);
          room = undefined; client = undefined;
          ws.close(1000, "left");
          return;
        case "CRDT_UPDATE": {
          try {
            const update = fromB64(msg.update);
            Y.applyUpdate(room.doc, update, client);
            broadcast(room, { type: "CRDT_UPDATE", update: msg.update }, client.user.id);
          } catch {
            log("SECURITY", `Malformed CRDT update in ${room.id}`);
            send(ws, { type: "ERROR", code: "BAD_UPDATE", message: "Malformed update" });
          }
          return;
        }
        case "CURSOR_UPDATE":
          client.user.anchor = msg.anchor;
          client.user.head = msg.head;
          client.user.cursors = [{ anchor: msg.anchor, head: msg.head }];
          broadcast(room, { type: "CURSOR_UPDATE", userId: client.user.id, anchor: msg.anchor, head: msg.head }, client.user.id);
          return;
        case "MULTI_CURSOR_UPDATE":
          // Store primary cursor in legacy fields for backward compat
          if (msg.cursors.length > 0) {
            client.user.anchor = msg.cursors[0]!.anchor;
            client.user.head = msg.cursors[0]!.head;
          }
          client.user.cursors = msg.cursors;
          broadcast(room, { type: "MULTI_CURSOR_UPDATE", userId: client.user.id, cursors: msg.cursors }, client.user.id);
          return;
        case "RUN_CODE": {
          void runRoomCode(room, runtime, client.user.name, msg.fileId).then((err) => {
            if (err) send(ws, { type: "ERROR", code: "RUN_REJECTED", message: err });
          });
          return;
        }
        case "STOP_CODE":
          if (room.activeExecutionId) void runtime.terminate(room.activeExecutionId);
          return;
        case "STDIN":
          // Forwarded straight to the running program's stdin - a no-op if nothing is running.
          if (room.activeExecutionId) runtime.writeStdin(room.activeExecutionId, msg.data);
          return;
        case "CHAT_MESSAGE": {
          const entry: ChatEntry = {
            id: randomBytes(6).toString("hex"),
            userId: client.user.id,
            name: client.user.name,
            colorIndex: client.user.colorIndex,
            text: msg.text,
            ts: Date.now(),
          };
          addChatEntry(room, entry);
          broadcast(room, { type: "CHAT_MESSAGE", entry });
          return;
        }
      }
    });

    ws.on("close", () => {
      clearTimeout(joinTimer);
      if (room && client) removeClient(room, client.user.id);
    });
    ws.on("error", () => ws.terminate());
  });

  // heartbeat: drop dead connections
  const hb = setInterval(() => {
    for (const ws of wss.clients) {
      const s = ws as WebSocket & { alive?: boolean };
      if (s.alive === false) { ws.terminate(); continue; }
      s.alive = false;
      ws.ping();
    }
  }, 30_000);
  wss.on("connection", (ws) => { (ws as WebSocket & { alive?: boolean }).alive = true; ws.on("pong", () => ((ws as WebSocket & { alive?: boolean }).alive = true)); });
  wss.on("close", () => clearInterval(hb));
  return wss;
}

