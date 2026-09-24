# Threat model (hackathon MVP)

**Not production-secure.** Containers share the host kernel; a kernel or runtime escape bug would compromise the host.

| # | Threat | MVP mitigation | Residual risk |
|---|---|---|---|
| 1 | Malicious code on the host | Code only ever runs inside `docker create`d containers; Node never `eval`s it | Container escape (shared kernel) → use Firecracker / gVisor |
| 2 | Infinite loop | 5 s timer → `docker kill` → `rm -f` | none significant |
| 3 | Fork bomb | `--pids-limit 64` | host-wide PID exhaustion is unlikely but possible on shared hosts |
| 4 | Memory exhaustion | `--memory 128m --memory-swap 128m`, `--max-old-space-size=96` | OOM kill shows as non-zero exit |
| 5 | CPU exhaustion | `--cpus 0.5`, 5 s cap, max 3 concurrent runs | 3 concurrent runs can still load a small host |
| 6 | Network abuse | `--network none` | none |
| 7 | Container escape attempts | `--cap-drop ALL`, `no-new-privileges`, non-root user 65534, read-only rootfs | Kernel 0-days; no seccomp customisation beyond Docker default |
| 8 | Host filesystem access | No bind mounts / volumes; code via stdin; `/tmp` is a 16 MB `noexec` tmpfs | none by design |
| 9 | Docker socket access | Socket is used only by the server process, never mounted into containers; browser has no Docker API | Anyone who can run the server has Docker privileges |
| 10 | Malicious WebSocket messages | zod schema on every message, 512 KB frame cap, invalid Yjs updates caught, flood limit 200 msg/10 s | No per-IP limits |
| 11 | Oversized source | Checked on the server's CRDT text before every run (≤ 20k chars); output capped 64 KB | Doc can grow up to the frame limit per update between runs (memory only) |
| 12 | Room abuse | Max 100 rooms, 10 users/room, empty rooms expire after 10 min, one run per room | No per-IP creation limit |
| 13 | Unauthorized room access | Unguessable 10-char random ID = capability link; unknown IDs rejected; WebSocket `Origin` check | Anyone with the link can edit and run; no auth |

Other notes: server never logs source code; `executionId`s are server-generated hex (safe as container names);
the browser cannot choose image, flags, limits, or code for a run. The pinned image is `node:22-alpine`.

## Runtime comparison
| | Docker (MVP) | Firecracker (future) |
|---|---|---|
| Kernel | shared with host | separate guest kernel |
| Boot | ~100-500 ms | ~125 ms from snapshot |
| Isolation boundary | namespaces + cgroups + seccomp | hardware virtualization (KVM) |

