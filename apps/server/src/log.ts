/** Structured logs. Never pass source code or secrets in here. */
export type Tag = "SERVER" | "ROOM" | "WS" | "EXECUTION" | "DOCKER" | "SECURITY" | "AI";
export function log(tag: Tag, msg: string) {
  console.log(`${new Date().toISOString()} [${tag}] ${msg}`);
}

