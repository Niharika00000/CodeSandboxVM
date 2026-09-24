import { randomBytes } from "node:crypto";
import * as Y from "yjs";
import type { WebSocket } from "ws";
import {
  LIMITS,
  type ChatEntry,
  type FileMeta,
  type ServerMessage,
  type UserInfo,
  LANGUAGE_REGISTRY,
  isSupportedLanguage,
  type Language,
} from "@sandbox/shared";
import { config } from "./config";
import { log } from "./log";

export const DEFAULT_CODE = `// Collaborative sandbox - edit together, press Run.
function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

console.log("Hello from an ephemeral sandbox");
console.log("fib(20) =", fib(20));
`;

export const MAIN_FILE_ID = "main";

export interface Client {
  ws: WebSocket;
  user: UserInfo;
}

export interface Room {
  id: string;
  doc: Y.Doc;
  clients: Map<string, Client>;
  createdAt: number;
  cleanupTimer?: NodeJS.Timeout;
  activeExecutionId?: string;
  chat: ChatEntry[];
}

const rooms = new Map<string, Room>();

/** files: Y.Map<fileId, FileMeta>. Each file's text lives at Y.Text(`file:${fileId}`). */
function seedFiles(doc: Y.Doc, initialLang?: string) {
  const files = doc.getMap<FileMeta>("files");
  const lang = (initialLang && isSupportedLanguage(initialLang.toLowerCase())) ? (initialLang.toLowerCase() as Language) : "javascript";
  const def = LANGUAGE_REGISTRY[lang];
  files.set(MAIN_FILE_ID, { id: MAIN_FILE_ID, name: def.defaultFileName, language: def.id });
  doc.getText(`file:${MAIN_FILE_ID}`).insert(0, def.templateCode);
}

export function createRoom(initialLang?: string): Room | null {
  if (rooms.size >= config.maxRooms) return null;
  const id = randomBytes(8).toString("base64url").slice(0, 10); // 10 chars, ~60 bits
  const doc = new Y.Doc();
  seedFiles(doc, initialLang);
  const room: Room = { id, doc, clients: new Map(), createdAt: Date.now(), chat: [] };
  scheduleCleanup(room); // deleted if nobody ever joins
  rooms.set(id, room);
  log("ROOM", `Room created ${id} (initial=${initialLang ?? "javascript"})`);
  return room;
}

export function addChatEntry(room: Room, entry: ChatEntry) {
  room.chat.push(entry);
  if (room.chat.length > LIMITS.MAX_CHAT_HISTORY) room.chat.splice(0, room.chat.length - LIMITS.MAX_CHAT_HISTORY);
}

export const getRoom = (id: string) => rooms.get(id);
export const roomCount = () => rooms.size;

export function scheduleCleanup(room: Room) {
  clearTimeout(room.cleanupTimer);
  room.cleanupTimer = setTimeout(() => {
    if (room.clients.size === 0) {
      room.doc.destroy();
      rooms.delete(room.id);
      log("ROOM", `Room expired ${room.id}`);
    }
  }, config.emptyRoomTtlMs);
}

export function addClient(room: Room, ws: WebSocket, name: string): Client | null {
  if (room.clients.size >= LIMITS.MAX_USERS_PER_ROOM) return null;
  clearTimeout(room.cleanupTimer);
  const used = new Set([...room.clients.values()].map((c) => c.user.colorIndex));
  let colorIndex = 0;
  while (used.has(colorIndex) && colorIndex < 7) colorIndex++;
  const user: UserInfo = { id: randomBytes(6).toString("hex"), name, colorIndex };
  const client = { ws, user };
  room.clients.set(user.id, client);
  log("ROOM", `User joined ${room.id} (${room.clients.size} connected)`);
  return client;
}

export function removeClient(room: Room, userId: string) {
  if (!room.clients.delete(userId)) return;
  broadcast(room, { type: "USER_LEFT", userId });
  log("ROOM", `User left ${room.id} (${room.clients.size} connected)`);
  if (room.clients.size === 0) scheduleCleanup(room);
}

export function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

export function broadcast(room: Room, msg: ServerMessage, exceptUserId?: string) {
  const data = JSON.stringify(msg);
  for (const c of room.clients.values()) {
    if (c.user.id !== exceptUserId && c.ws.readyState === c.ws.OPEN) c.ws.send(data);
  }
}

