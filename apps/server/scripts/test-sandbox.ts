// Requires Docker + image pulled (npm run docker:pull). Runs the real DockerRuntime directly.
import { randomBytes } from "node:crypto";
import { DockerRuntime } from "../src/sandbox/docker";

const rt = new DockerRuntime();
let failed = 0;

async function run(name: string, code: string, expect: (r: Awaited<ReturnType<typeof rt.execute>>, out: string, err: string) => boolean, language = "javascript", fileName?: string) {
  let out = "", err = "";
  const r = await rt.execute(
    { executionId: randomBytes(6).toString("hex"), language, code, fileName },
    { onStatus: () => {}, onStdout: (d) => (out += d), onStderr: (d) => (err += d) },
  );
  const ok = expect(r, out, err);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (${r.outcome}, exit=${r.exitCode}, ${r.durationMs}ms)`);
  if (!ok) { failed++; console.log({ out: out.slice(0, 200), err: err.slice(0, 200), reason: r.reason }); }
}

await run("hello world", `console.log("hi")`, (r, o) => r.outcome === "completed" && r.exitCode === 0 && o.trim() === "hi");
await run("runtime error goes to stderr", `x.y`, (r, _o, e) => r.exitCode !== 0 && e.includes("ReferenceError"));
await run("infinite loop is killed at timeout", `while(true){}`, (r) => r.outcome === "timeout");
await run("network is unreachable", `
  fetch("https://example.com").then(()=>console.log("NET_OK")).catch(()=>console.log("NET_BLOCKED"))`,
  (_r, o) => o.includes("NET_BLOCKED"));
await run("root filesystem is read-only", `
  require("fs").writeFile("/etc/pwn","x",e=>console.log(e?"RO":"WROTE"))`, (_r, o) => o.includes("RO"));
await run("runs as non-root", `console.log(process.getuid())`, (_r, o) => o.trim() === "65534");
await run("memory hog is limited", `const a=[];while(true)a.push(Buffer.alloc(10*1024*1024,1))`, (r) => r.outcome !== "completed" || r.exitCode !== 0);
await run("fork bomb is contained", `
  const {spawn}=require("child_process");
  for(let i=0;i<500;i++){try{spawn("node",["-e","setInterval(()=>{},1000)"])}catch{}}
  setInterval(()=>{},1000)`, (r) => r.outcome === "timeout" || r.exitCode !== 0);
await run("output flood is capped", `while(true)console.log("x".repeat(1000))`, (r) => r.outcome !== "completed");

console.log(failed ? `\n${failed} FAILED` : "\nAll sandbox tests passed");
process.exit(failed ? 1 : 0);
