---
phase: 2
slug: performance-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (tsc) + pnpm build |
| **Config file** | `packages/webview-ui/tsconfig.app.json`, `packages/prisma-generate-uml/tsconfig.json` |
| **Quick run command** | `pnpm --filter webview-ui exec tsc --noEmit` |
| **Full suite command** | `pnpm build` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter webview-ui exec tsc --noEmit`
- **After every plan wave:** Run `pnpm build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | PERF-02 | — | N/A | build | `pnpm --filter webview-ui exec tsc --noEmit` | ✅ | ⬜ pending |
| 02-01-02 | 01 | 1 | PERF-01 | — | N/A | build | `pnpm --filter webview-ui exec tsc --noEmit` | ✅ | ⬜ pending |
| 02-02-01 | 02 | 1 | PERF-03 | — | N/A | build | `pnpm --filter webview-ui exec tsc --noEmit` | ✅ | ⬜ pending |
| 02-02-02 | 02 | 1 | PERF-04 | — | N/A | build | `pnpm --filter webview-ui exec tsc --noEmit` | ✅ | ⬜ pending |
| 02-03-01 | 03 | 1 | TYPE-03 | — | N/A | build | `pnpm --filter webview-ui exec tsc --noEmit` | ✅ | ⬜ pending |
| 02-03-02 | 03 | 1 | TYPE-04 | — | N/A | build | `pnpm --filter webview-ui exec tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. TypeScript compiler is already installed and configured — no additional test setup needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Debounce 200ms window visible in filter | PERF-01 | Requires UI interaction timing | Type rapidly in search box; verify ELK layout fires at most once per 200ms via React DevTools |
| BFS cache speedup on second visit | PERF-04 | Requires profiling | Click focus on node A, click elsewhere, click focus on node A again; second visit should be visibly instant |
| ELK singleton not re-instantiated | PERF-02 | Requires console observation | Add temporary console.log in layout-utils.ts; verify single instantiation on page load |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
