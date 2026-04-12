# Phase 2: Performance Core - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-04-12
**Phase:** 02-performance-core
**Mode:** assumptions
**Areas analyzed:** ELK Singleton, Layout Debounce Placement, BFS Cache, PostMessage Type Wiring, Debounce Implementation

## Assumptions Presented

### ELK Singleton (PERF-02)
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Move `new ELK()` to module-level in `layout-utils.ts:59` | Likely | Per-call construction at line 59; WASM variant is JS-event-loop serialized |

### Layout Debounce Placement (PERF-01)
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Debounce `searchQuery` in `SchemaVisualizer.tsx` before `filteredNodes` useMemo (line 148), not inside `useGraph.ts` | Confident | Chain: searchQuery → filteredNodes → useGraph effect → ELK; useGraph has fragile eslint-disable at line 126 |

### BFS Cache (PERF-03 + PERF-04)
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| `useRef<Map>` cache in SchemaVisualizer keyed `"startId:depth:edgeSignature"`, invalidated on allEdges reference change | Likely | bfsNeighbors in graph-utils.ts; allEdges already useMemo-stabilized in SchemaVisualizer |

### PostMessage Type Wiring (TYPE-03 + TYPE-04)
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| App.tsx if-chain → exhaustive switch over ExtensionMessage; vscode-api.ts postMessage(any) → postMessage(WebviewMessage) | Confident | messages.ts exists from Phase 1; App.tsx:23-33 untyped; vscode-api.ts:1-5 uses any |

### Debounce Implementation (PERF-01 technical)
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| New `use-debounced-value.ts` hook, no library | Likely | Zero existing debounce utilities; lean-dependency constraint in CLAUDE.md; 2 existing hook files as precedent |

## Corrections Made

No corrections — all assumptions confirmed by user.

## External Research

ELK singleton thread-safety was flagged as a research topic. Resolved by reasoning: `elk.bundled.js` uses synchronous WASM on the JS event loop — calls are inherently serialized. No concurrent interference possible in a single-threaded browser environment.
