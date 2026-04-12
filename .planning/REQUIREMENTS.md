# Requirements: prisma-generate-uml

**Defined:** 2026-04-12
**Core Value:** Instant, interactive Prisma schema visualization without leaving VS Code

## v1 Requirements

### Type Safety

- [ ] **TYPE-01**: All Prisma model node type names use correct spelling (`ModelNodeType`, `EnumNodeType` — currently `ModelNodeTye`, `EnumNodeTye`)
- [ ] **TYPE-02**: Extension↔webview message protocol uses discriminated union types (`messages.ts`) instead of `any`
- [ ] **TYPE-03**: Webview `App.tsx` message handler uses the discriminated union (no untyped `event.data` casts)
- [ ] **TYPE-04**: `vscode-api.ts` postMessage call is typed via the shared `WebviewMessage` union

### Performance — Layout

- [ ] **PERF-01**: Filter input changes (search query keystrokes) debounced 200ms before triggering layout recalculation
- [ ] **PERF-02**: ELK instance created once as module-level singleton (not re-instantiated per layout call)
- [ ] **PERF-03**: BFS neighbor traversal uses a pre-built adjacency `Map` instead of iterating all edges per hop
- [ ] **PERF-04**: BFS result memoized — same `focusedNodeId + focusDepth` does not re-traverse the graph

### Performance — Rendering

- [ ] **PERF-05**: `ModelNode` wrapped in `React.memo` to skip re-renders on pan/zoom
- [ ] **PERF-06**: `EnumNode` wrapped in `React.memo` to skip re-renders on pan/zoom
- [ ] **PERF-07**: `RelationEdge` wrapped in `React.memo` to skip re-renders on pan/zoom
- [ ] **PERF-08**: FilterContext and SettingsContext value objects wrapped in `useMemo` to prevent spurious re-renders

### Screenshot Reliability

- [ ] **SCRN-01**: Screenshot export handles canvas allocation failure gracefully (error dialog instead of silent failure)
- [ ] **SCRN-02**: Screenshot export retries at lower resolution (2×) if 4× allocation fails
- [ ] **SCRN-03**: User can select screenshot resolution preset (Screen 1×, Retina 2×, Print 4×) via Sidebar control
- [ ] **SCRN-04**: `screnshot.ts` renamed to `screenshot.ts` (fixes typo in filename)
- [ ] **SCRN-05**: Warning shown before export when >80 visible models (memory risk notification)

### Code Health

- [ ] **CODE-01**: `useGraph.ts` `eslint-disable` comment for `exhaustive-deps` replaced with clear explanation of the async deduplication invariant
- [ ] **CODE-02**: `messages.ts` shared type file includes inline comment explaining runtime cast limitation and zod upgrade path

## v2 Requirements

### Performance — Advanced

- **ADV-01**: ELK Web Worker migration for non-blocking layout on 100+ model schemas
- **ADV-02**: Layout position cache keyed by `(direction:sortedVisibleNodeIds)` — eliminates repeated ELK calls for unchanged visible sets
- **ADV-03**: Context split: `FilterStateContext` + `FilterActionsContext` to prevent action-only components from subscribing to state changes

### Export Enhancements

- **EXP-01**: Resolution preference persists across VS Code sessions (`globalState`)
- **EXP-02**: Export progress bar in webview for large schemas
- **EXP-03**: SVG export option (lossless, smaller file)

### Developer Experience

- **DX-01**: Runtime message validation via zod (currently relying on TypeScript cast only)
- **DX-02**: Schema node count benchmark script to calibrate screenshot memory warning threshold

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time collaboration | Single-user VS Code extension by design |
| SQL generation from diagram | Different tool category |
| Prisma migration management | Belongs in Prisma CLI |
| Multi-schema merge view | High complexity, no clear user demand yet |
| OAuth/auth for diagram sharing | Not a cloud product |
| `vscode-messenger` library | Over-engineering for 4 message types; manual discriminated unions sufficient |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TYPE-01 | Phase 1 | Pending |
| TYPE-02 | Phase 1 | Pending |
| TYPE-03 | Phase 2 | Pending |
| TYPE-04 | Phase 2 | Pending |
| PERF-05 | Phase 1 | Pending |
| PERF-06 | Phase 1 | Pending |
| PERF-07 | Phase 1 | Pending |
| PERF-08 | Phase 1 | Pending |
| CODE-01 | Phase 1 | Pending |
| CODE-02 | Phase 1 | Pending |
| SCRN-04 | Phase 1 | Pending |
| PERF-01 | Phase 2 | Pending |
| PERF-02 | Phase 2 | Pending |
| PERF-03 | Phase 2 | Pending |
| PERF-04 | Phase 2 | Pending |
| SCRN-01 | Phase 3 | Pending |
| SCRN-02 | Phase 3 | Pending |
| SCRN-03 | Phase 3 | Pending |
| SCRN-05 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-12*
*Last updated: 2026-04-12 after initial definition*
