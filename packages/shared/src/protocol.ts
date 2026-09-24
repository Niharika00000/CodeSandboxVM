import { z } from "zod";

/** Room IDs are random + unguessable: knowing the ID is the "capability" to join. */
export const ROOM_ID_REGEX = /^[A-Za-z0-9_-]{8,16}$/;

export const LIMITS = {
  MAX_SOURCE_CHARS: 20_000,
  MAX_WS_PAYLOAD_BYTES: 512 * 1024,
  MAX_USERS_PER_ROOM: 10,
  MAX_NAME_LEN: 24,
  MAX_CHAT_LEN: 2000,
  MAX_CHAT_HISTORY: 200,
  MAX_FILES_PER_ROOM: 40,
  MAX_FILENAME_LEN: 80,
  MAX_STDIN_CHUNK: 4096,
} as const;

export const SUPPORTED_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "c",
  "cpp",
  "java",
  "go",
  "rust",
  "shell",
  "ruby",
  "php",
] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export interface LanguageDefinition {
  id: Language;
  name: string;
  extension: string;
  defaultFileName: string;
  runtimeLabel: string;
  defaultImage: string;
  templateCode: string;
}

export const LANGUAGE_REGISTRY: Record<Language, LanguageDefinition> = {
  javascript: {
    id: "javascript",
    name: "JavaScript",
    extension: "js",
    defaultFileName: "main.js",
    runtimeLabel: "Node 22",
    defaultImage: "node:22-alpine",
    templateCode: `// Collaborative sandbox - JavaScript (Node 22)
function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

console.log("Hello from JavaScript!");
console.log("fib(20) =", fib(20));
`,
  },
  typescript: {
    id: "typescript",
    name: "TypeScript",
    extension: "ts",
    defaultFileName: "main.ts",
    runtimeLabel: "Node 22 (Strip Types)",
    defaultImage: "node:22-alpine",
    templateCode: `// Collaborative sandbox - TypeScript
function fib(n: number): number {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

const n: number = 20;
console.log("Hello from TypeScript!");
console.log(\`fib(\${n}) =\`, fib(n));
`,
  },
  python: {
    id: "python",
    name: "Python",
    extension: "py",
    defaultFileName: "main.py",
    runtimeLabel: "Python 3.12",
    defaultImage: "python:3.12-alpine",
    templateCode: `# Collaborative sandbox - Python 3.12
def fib(n: int) -> int:
    return n if n < 2 else fib(n - 1) + fib(n - 2)

print("Hello from Python!")
print("fib(20) =", fib(20))
`,
  },
  c: {
    id: "c",
    name: "C",
    extension: "c",
    defaultFileName: "main.c",
    runtimeLabel: "GCC (C17)",
    defaultImage: "gcc:alpine",
    templateCode: `// Collaborative sandbox - C (GCC)
#include <stdio.h>

long long fib(int n) {
    if (n < 2) return n;
    long long a = 0, b = 1;
    for (int i = 2; i <= n; i++) {
        long long c = a + b;
        a = b;
        b = c;
    }
    return b;
}

int main(void) {
    printf("Hello from C!\\n");
    printf("fib(20) = %lld\\n", fib(20));
    return 0;
}
`,
  },
  cpp: {
    id: "cpp",
    name: "C++",
    extension: "cpp",
    defaultFileName: "main.cpp",
    runtimeLabel: "G++ (C++20)",
    defaultImage: "gcc:alpine",
    templateCode: `// Collaborative sandbox - C++20 (G++)
#include <iostream>

long long fib(int n) {
    if (n < 2) return n;
    long long a = 0, b = 1;
    for (int i = 2; i <= n; i++) {
        long long c = a + b;
        a = b;
        b = c;
    }
    return b;
}

int main() {
    std::cout << "Hello from C++!" << std::endl;
    std::cout << "fib(20) = " << fib(20) << std::endl;
    return 0;
}
`,
  },
  java: {
    id: "java",
    name: "Java",
    extension: "java",
    defaultFileName: "Main.java",
    runtimeLabel: "OpenJDK 21",
    defaultImage: "eclipse-temurin:21-alpine",
    templateCode: `// Collaborative sandbox - Java 21
public class Main {
    static long fib(int n) {
        if (n < 2) return n;
        long a = 0, b = 1;
        for (int i = 2; i <= n; i++) {
            long c = a + b;
            a = b;
            b = c;
        }
        return b;
    }

    public static void main(String[] args) {
        System.out.println("Hello from Java!");
        System.out.println("fib(20) = " + fib(20));
    }
}
`,
  },
  go: {
    id: "go",
    name: "Go",
    extension: "go",
    defaultFileName: "main.go",
    runtimeLabel: "Go 1.23",
    defaultImage: "golang:1.23-alpine",
    templateCode: `// Collaborative sandbox - Go 1.23
package main

import "fmt"

func fib(n int) int {
	if n < 2 {
		return n
	}
	return fib(n-1) + fib(n-2)
}

func main() {
	fmt.Println("Hello from Go!")
	fmt.Printf("fib(20) = %d\\n", fib(20))
}
`,
  },
  rust: {
    id: "rust",
    name: "Rust",
    extension: "rs",
    defaultFileName: "main.rs",
    runtimeLabel: "Rust 1.82",
    defaultImage: "rust:1.82-alpine",
    templateCode: `// Collaborative sandbox - Rust 1.82
fn fib(n: u32) -> u64 {
    if n < 2 {
        return n as u64;
    }
    let mut a: u64 = 0;
    let mut b: u64 = 1;
    for _ in 2..=n {
        let c = a + b;
        a = b;
        b = c;
    }
    b
}

fn main() {
    println!("Hello from Rust!");
    println!("fib(20) = {}", fib(20));
}
`,
  },
  shell: {
    id: "shell",
    name: "Bash / Shell",
    extension: "sh",
    defaultFileName: "main.sh",
    runtimeLabel: "Bash (Alpine)",
    defaultImage: "bash:alpine",
    templateCode: `#!/bin/bash
# Collaborative sandbox - Bash
echo "Hello from Bash!"
echo "Current date: $(date)"
echo "Host info: $(uname -a)"
`,
  },
  ruby: {
    id: "ruby",
    name: "Ruby",
    extension: "rb",
    defaultFileName: "main.rb",
    runtimeLabel: "Ruby 3.3",
    defaultImage: "ruby:3.3-alpine",
    templateCode: `# Collaborative sandbox - Ruby 3.3
def fib(n)
  return n if n < 2
  fib(n - 1) + fib(n - 2)
end

puts "Hello from Ruby!"
puts "fib(20) = #{fib(20)}"
`,
  },
  php: {
    id: "php",
    name: "PHP",
    extension: "php",
    defaultFileName: "main.php",
    runtimeLabel: "PHP 8.3",
    defaultImage: "php:8.3-cli-alpine",
    templateCode: `<?php
// Collaborative sandbox - PHP 8.3
function fib($n) {
    return $n < 2 ? $n : fib($n - 1) + fib($n - 2);
}

echo "Hello from PHP!\\n";
echo "fib(20) = " . fib(20) . "\\n";
`,
  },
};

export function isSupportedLanguage(lang: string | undefined): lang is Language {
  return typeof lang === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(lang.toLowerCase());
}

export function isRunnableLanguage(lang: string | undefined): boolean {
  return isSupportedLanguage(lang);
}

export type SandboxStatus =
  | "CREATING"
  | "COMPILING"
  | "RUNNING"
  | "COMPLETED"
  | "TIMEOUT"
  | "FAILED"
  | "STOPPED"
  | "DESTROYED";

export interface CursorRange {
  anchor: number;
  head: number;
}

export interface UserInfo {
  id: string;
  name: string;
  /** index into a fixed palette (0-7) so the client can style cursors */
  colorIndex: number;
  /** Legacy single cursor kept for backward compat with server relay */
  anchor?: number;
  head?: number;
  /** Multi-cursor: all active selection ranges for this user */
  cursors?: CursorRange[];
}

/** One entry in a file tree. Content itself lives in Y.Text(`file:${id}`) inside the shared Y.Doc. */
export interface FileMeta {
  id: string;
  name: string; // e.g. "utils.js" or "src/utils.js" if imported from a folder
  language: string; // monaco language id, inferred from extension
}

export interface ChatEntry {
  id: string;
  userId: string;
  name: string;
  colorIndex: number;
  text: string;
  ts: number;
}

export interface ExecutionLimits {
  runtime: string; // e.g. "docker (container - NOT a microVM)"
  image: string;
  timeoutMs: number;
  memory: string;
  cpus: string;
  pids: number;
  network: "disabled";
}

/* ------------------------------ client -> server ------------------------------ */
export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("JOIN_ROOM"),
    roomId: z.string().regex(ROOM_ID_REGEX),
    name: z.string().trim().min(1).max(LIMITS.MAX_NAME_LEN),
  }),
  z.object({ type: z.literal("LEAVE_ROOM") }),
  // base64 Yjs update
  z.object({ type: z.literal("CRDT_UPDATE"), update: z.string().max(700_000) }),
  z.object({
    type: z.literal("CURSOR_UPDATE"),
    anchor: z.number().int().min(0).max(1_000_000),
    head: z.number().int().min(0).max(1_000_000),
  }),
  z.object({
    type: z.literal("MULTI_CURSOR_UPDATE"),
    cursors: z.array(
      z.object({
        anchor: z.number().int().min(0).max(1_000_000),
        head: z.number().int().min(0).max(1_000_000),
      })
    ).max(20),
  }),
  // NOTE: no source code here. The server reads code from its own CRDT copy.
  z.object({ type: z.literal("RUN_CODE"), language: z.string().max(32).optional(), fileId: z.string().max(64).optional() }),
  z.object({ type: z.literal("STOP_CODE") }),
  z.object({ type: z.literal("CHAT_MESSAGE"), text: z.string().trim().min(1).max(LIMITS.MAX_CHAT_LEN) }),
  // Keystrokes forwarded to the running program's stdin (e.g. answering a readline prompt).
  z.object({ type: z.literal("STDIN"), data: z.string().max(LIMITS.MAX_STDIN_CHUNK) }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

/* ------------------------------ server -> client ------------------------------ */
export type ServerMessage =
  | { type: "SYNC_STATE"; update: string; you: UserInfo; users: UserInfo[]; chatHistory: ChatEntry[] }
  | { type: "CRDT_UPDATE"; update: string }
  | { type: "USER_JOINED"; user: UserInfo }
  | { type: "USER_LEFT"; userId: string }
  | { type: "CURSOR_UPDATE"; userId: string; anchor: number; head: number }
  | { type: "MULTI_CURSOR_UPDATE"; userId: string; cursors: CursorRange[] }
  | { type: "EXECUTION_STARTED"; executionId: string; startedBy: string; limits: ExecutionLimits }
  | { type: "SANDBOX_STATUS"; executionId: string; status: SandboxStatus }
  | { type: "STDOUT"; executionId: string; data: string }
  | { type: "STDERR"; executionId: string; data: string }
  | { type: "EXECUTION_COMPLETED"; executionId: string; exitCode: number; durationMs: number }
  | { type: "EXECUTION_TIMEOUT"; executionId: string; durationMs: number }
  | { type: "EXECUTION_FAILED"; executionId: string; reason: string; durationMs: number }
  | { type: "CHAT_MESSAGE"; entry: ChatEntry }
  | { type: "ERROR"; code: string; message: string };
