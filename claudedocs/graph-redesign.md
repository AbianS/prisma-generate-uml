# Graph Visualization Redesign

**Project:** prisma-generate-uml  
**Scope:** `packages/webview-ui/src/`  
**Date:** 2026-04-07  
**Status:** Design / Pre-implementation

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Layout Engine Redesign](#2-layout-engine-redesign)
3. [New Filtering System](#3-new-filtering-system)
4. [New Sidebar Panel](#4-new-sidebar-panel)
5. [Connection Highlighting](#5-connection-highlighting)
6. [Edge Redesign](#6-edge-redesign)
7. [Node Card Redesign](#7-node-card-redesign)
8. [Implementation Roadmap](#8-implementation-roadmap)

---

## 1. Architecture Overview

### 1.1 Current File Structure (annotated with problems)

```
src/
├── App.tsx                          # OK — message bridge to extension
├── components/
│   ├── SchemaVisualizer.tsx         # MODIFY — wires everything together
│   ├── ModelNode.tsx                # MODIFY — fixed width, fragile handle math
│   ├── EnumNode.tsx                 # MODIFY — minor cleanup
│   └── SettingsPanel.tsx            # REPLACE — remove Leva dependency
├── lib/
│   ├── types/schema.ts              # MODIFY — extend ModelConnection
│   ├── contexts/settings.tsx        # MODIFY — remove layout field (sidebar owns it)
│   ├── hooks/useGraph.ts            # MODIFY — integrate useNodesInitialized
│   └── utils/layout-utils.ts       # REWRITE — singleton bug, fixed dimensions
```

### 1.2 Target File Structure

```
src/
├── App.tsx                          # unchanged
├── components/
│   ├── SchemaVisualizer.tsx         # modified: add sidebar, remove SettingsPanel
│   ├── ModelNode.tsx                # modified: dynamic sizing, CSS handles
│   ├── EnumNode.tsx                 # minor: max-width cap
│   ├── Sidebar.tsx                  # NEW: replaces SettingsPanel
│   └── edges/
│       └── RelationEdge.tsx         # NEW: relationship-aware edge renderer
├── lib/
│   ├── types/schema.ts              # modified: RelationType, extended ModelConnection
│   ├── contexts/
│   │   ├── settings.tsx             # modified: remove layout key
│   │   └── filter.tsx               # NEW: FilterContext + useFilter
│   ├── hooks/
│   │   ├── useGraph.ts              # modified: useNodesInitialized integration
│   │   └── useConnectionHighlight.ts # NEW: selection-driven dim/highlight
│   └── utils/
│       └── layout-utils.ts          # rewritten: per-call graph, full dagre config
```

### 1.3 Data Flow

```
Extension (VS Code)
  │  postMessage { command: 'setData', models, connections, enums }
  ▼
App.tsx
  │  useState: models, connections, enums, theme
  ▼
FilterProvider (filter.tsx)
  │  Derives: visibleNodes, visibleEdges from raw data + filter state
  ▼
SettingsProvider (settings.tsx)
  │  Provides: display toggles, theme colors
  ▼
ReactFlowProvider
  ▼
SchemaVisualizer.tsx
  ├── useGraph(visibleNodes, visibleEdges, settings)
  │     ├── useNodesInitialized → triggers layout after measure
  │     └── getLayoutedElements (layout-utils.ts) — new per-call instance
  ├── useConnectionHighlight()
  │     └── useOnSelectionChange → setNodes/setEdges style updates
  └── Renders:
        ├── <Sidebar />              ← search, model list, layout controls, toggles
        ├── <ReactFlow>
        │     ├── nodeTypes: { model: ModelNode, enum: EnumNode }
        │     └── edgeTypes: { relation: RelationEdge }
        ├── <Controls>, <MiniMap>, <Background>
        └── (SettingsPanel removed)
```

### 1.4 Component Hierarchy

```
App
└── ThemeProvider
    └── FilterProvider            ← new
        └── SettingsProvider
            └── ReactFlowProvider
                └── SchemaVisualizer
                    ├── Sidebar
                    │   ├── SearchInput
                    │   ├── ModelList
                    │   │   └── ModelListItem (× N)
                    │   ├── LayoutControls
                    │   ├── VisualToggles
                    │   └── ThemeSection (collapsed)
                    └── ReactFlow
                        ├── ModelNode (× N)
                        ├── EnumNode (× N)
                        └── RelationEdge (× N)
```

---

## 2. Layout Engine Redesign

### 2.1 Problems in the Current Implementation

| Problem | Location | Effect |
|---|---|---|
| Singleton `dagreGraph` created once at module level | `layout-utils.ts:5` | Nodes from previous schema bleed into next layout call |
| Fixed `nodeWidth = 250`, `nodeHeight = 400` | `layout-utils.ts:8-9` | Nodes with few fields get huge gaps; nodes with many fields overlap |
| Only `rankdir` set on the graph | `layout-utils.ts:18-20` | No separation control; default dagre spacing is too tight |
| No `nodesep`/`ranksep` | omitted | Siblings and ranks collide on dense schemas |
| No `acyclicer` | omitted | Circular Prisma relations (self-referential models) cause infinite loops |
| Layout runs synchronously before React measures nodes | `useGraph.ts:95` | Dimensions are always 0 at first call; layout is always wrong on initial render |

### 2.2 Rewritten `layout-utils.ts`

**Key changes:**

- Create a new `dagre.graphlib.Graph()` on every call — never reuse.
- Set the full recommended config.
- Accept `measuredWidth`/`measuredHeight` from React Flow's `node.measured`.
- Return `sourcePosition`/`targetPosition` per-node based on direction (already done, preserved).

```typescript
import dagre from '@dagrejs/dagre';
import { Edge, Position } from '@xyflow/react';
import { MyNode } from '../types/schema';

const DEFAULT_NODE_WIDTH  = 220;  // fallback only — used before first measure
const DEFAULT_NODE_HEIGHT = 36;   // fallback — single-row minimum

export type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL';

export function getLayoutedElements(
  nodes: MyNode[],
  edges: Edge[],
  direction: LayoutDirection = 'TB',
) {
  // Always create a fresh instance — never reuse the module-level singleton
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir:   direction,
    ranker:    'network-simplex',  // best quality for DAG-like schemas
    acyclicer: 'greedy',           // handles self-referential Prisma models
    nodesep:   60,                 // horizontal gap between sibling nodes (px)
    ranksep:   120,                // vertical gap between ranks/layers (px)
    marginx:   40,
    marginy:   40,
  });

  const isHorizontal = direction === 'LR' || direction === 'RL';

  nodes.forEach((node) => {
    g.setNode(node.id, {
      // Use React Flow's measured dimensions when available
      width:  node.measured?.width  ?? DEFAULT_NODE_WIDTH,
      height: node.measured?.height ?? DEFAULT_NODE_HEIGHT,
    });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const { x, y, width, height } = g.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left  : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        // Dagre returns center coordinates; React Flow expects top-left
        x: x - width  / 2,
        y: y - height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
```

### 2.3 Dynamic Sizing with `useNodesInitialized`

The layout must run **after** React Flow measures nodes, not before. The fix is to subscribe to `useNodesInitialized` and delay the layout call until measurements are available.

Integration inside `useGraph.ts`:

```typescript
import { useNodesInitialized } from '@xyflow/react';

const nodesInitialized = useNodesInitialized({ includeHiddenNodes: false });

// Run layout after React Flow has measured all visible nodes
useEffect(() => {
  if (!nodesInitialized) return;
  if (!nodes.length)      return;

  const { nodes: laid, edges: laidEdges } =
    getLayoutedElements(nodes, edges, selectedLayout);

  setNodes(laid);
  setEdges(laidEdges);
  setShouldFitView(true);
}, [nodesInitialized]);
// Note: intentionally NOT including nodes/edges in deps — this effect
// fires once after the initial measurement pass, then again when the
// schema changes (handled by the schema-change effect below).
```

**Two-phase rendering:**

1. React renders nodes at `position: { x: 0, y: 0 }` with `opacity: 0` (hide until placed).
2. React Flow measures them internally; `nodesInitialized` flips to `true`.
3. `useEffect` fires → `getLayoutedElements` runs with real dimensions.
4. Nodes animate into position; `fitView` runs.

Add `opacity: 0` on initial nodes and remove it after layout is applied:

```typescript
// When building initial nodes in SchemaVisualizer:
const modelNodes = useMemo(() => models.map((model) => ({
  id:       model.name,
  data:     model,
  type:     'model',
  position: { x: 0, y: 0 },
  style:    { opacity: isLayoutReady ? 1 : 0 },
})), [models, isLayoutReady]);
```

### 2.4 Handle Position Calculation

**Current code (fragile):**

```typescript
// ModelNode.tsx:114 — hardcoded arithmetic tied to assumed row heights
style={{ top: 27 + 16 + 27 * index }}
```

This breaks if Tailwind padding changes, if field icons are hidden, or if font size differs.

**Replacement approach — CSS-relative positioning:**

Remove the `style.top` override entirely. Instead, make each field row a `position: relative` container and render the handle inside it with `position: absolute; right: -8px; top: 50%; transform: translateY(-50%)`.

React Flow's `Handle` component accepts `className` and `style`. The correct pattern:

```typescript
{hasConnections && (
  <Handle
    position={Position.Right}
    id={`${data.name}-${name}-source`}
    type="source"
    className="field-handle"
    // No top offset needed — handle is inside the row's own DOM element
    // React Flow resolves position relative to the node root automatically
    // when the handle is a descendant of a positioned ancestor
  />
)}
```

CSS (Tailwind or a stylesheet):

```css
.field-handle {
  position: absolute;
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  /* React Flow's default handle size is 10px */
}
```

Each field row must be `position: relative` to scope the absolute handle. Tailwind: add `relative` to the field `<div>`.

---

## 3. New Filtering System

### 3.1 Data Types

```typescript
// lib/types/filter.ts

export interface FilterState {
  focusedNodeId:  string | null;
  searchQuery:    string;
  hiddenNodeIds:  Set<string>;
  focusDepth:     1 | 2 | 3;
}

export interface FilterActions {
  focusNode:       (id: string)  => void;
  clearFocus:      ()            => void;
  toggleHideNode:  (id: string)  => void;
  setSearchQuery:  (q: string)   => void;
  setFocusDepth:   (d: 1|2|3)   => void;
  resetAll:        ()            => void;
}

export type FilterContextValue = FilterState & FilterActions;
```

### 3.2 `FilterContext` and `FilterProvider`

```typescript
// lib/contexts/filter.tsx

const FilterContext = createContext<FilterContextValue | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FilterState>({
    focusedNodeId: null,
    searchQuery:   '',
    hiddenNodeIds: new Set(),
    focusDepth:    1,
  });

  const focusNode = useCallback((id: string) => {
    setState(prev => ({ ...prev, focusedNodeId: id }));
  }, []);

  const clearFocus = useCallback(() => {
    setState(prev => ({ ...prev, focusedNodeId: null }));
  }, []);

  const toggleHideNode = useCallback((id: string) => {
    setState(prev => {
      const next = new Set(prev.hiddenNodeIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { ...prev, hiddenNodeIds: next };
    });
  }, []);

  const setSearchQuery = useCallback((q: string) => {
    setState(prev => ({ ...prev, searchQuery: q }));
  }, []);

  const setFocusDepth = useCallback((d: 1|2|3) => {
    setState(prev => ({ ...prev, focusDepth: d }));
  }, []);

  const resetAll = useCallback(() => {
    setState({ focusedNodeId: null, searchQuery: '', hiddenNodeIds: new Set(), focusDepth: 1 });
  }, []);

  return (
    <FilterContext.Provider value={{ ...state, focusNode, clearFocus, toggleHideNode, setSearchQuery, setFocusDepth, resetAll }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilter must be used within FilterProvider');
  return ctx;
}
```

### 3.3 BFS Focus Algorithm

```typescript
// lib/utils/graph-utils.ts

/**
 * Returns the set of node IDs reachable from `startId` within `depth` hops,
 * traversing edges in both directions.
 */
export function bfsNeighbors(
  startId:  string,
  edges:    Edge[],
  depth:    number,
): Set<string> {
  const visited = new Set([startId]);
  let frontier  = new Set([startId]);

  for (let hop = 0; hop < depth; hop++) {
    const next = new Set<string>();
    for (const edge of edges) {
      if (frontier.has(edge.source) && !visited.has(edge.target)) {
        next.add(edge.target);
      }
      if (frontier.has(edge.target) && !visited.has(edge.source)) {
        next.add(edge.source);
      }
    }
    next.forEach(id => visited.add(id));
    frontier = next;
    if (frontier.size === 0) break;
  }

  return visited;
}
```

### 3.4 Applying Filter State to React Flow Nodes/Edges

Filter state is computed in `useGraph` (or a dedicated `useFilteredGraph` hook) and produces the `hidden` prop on nodes and edges. React Flow natively supports `node.hidden` to exclude a node from rendering while preserving its state.

```typescript
// Inside useGraph or a useFilteredGraph hook

function applyFilter(
  nodes:    MyNode[],
  edges:    Edge[],
  filter:   FilterState,
): { nodes: MyNode[]; edges: Edge[] } {
  // 1. Build the set of visible node IDs
  let visibleIds: Set<string> | null = null;

  if (filter.focusedNodeId) {
    visibleIds = bfsNeighbors(filter.focusedNodeId, edges, filter.focusDepth);
  }

  const query = filter.searchQuery.trim().toLowerCase();

  const visibleNodes = nodes.map(node => {
    const matchesSearch  = !query || node.id.toLowerCase().includes(query);
    const matchesFocus   = !visibleIds || visibleIds.has(node.id);
    const notManualHide  = !filter.hiddenNodeIds.has(node.id);
    return { ...node, hidden: !(matchesSearch && matchesFocus && notManualHide) };
  });

  // An edge is visible only if both endpoints are visible
  const visibleNodeIds = new Set(visibleNodes.filter(n => !n.hidden).map(n => n.id));
  const visibleEdges = edges.map(edge => ({
    ...edge,
    hidden: !visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target),
  }));

  return { nodes: visibleNodes, edges: visibleEdges };
}
```

**Important:** When the filter changes, the layout must re-run because visible node dimensions change. Trigger layout by watching the set of visible node IDs (not the full filter object) to avoid unnecessary re-layouts.

---

## 4. New Sidebar Panel

### 4.1 Design Goals

| Goal | Rationale |
|---|---|
| Replace Leva entirely | Leva is a developer debug tool, not a user interface |
| Left-anchored, fixed width | Conventional for graph explorer tools (Nx graph, Prisma Studio) |
| Collapsible | Users with small screens or large schemas need full canvas width |
| Section-based | Separate concerns: navigation vs. layout vs. visual vs. theme |

### 4.2 Props Interface

```typescript
// components/Sidebar.tsx

export interface SidebarProps {
  models:          Model[];
  enums:           Enum[];
  edges:           Edge[];          // needed to compute connection counts
  selectedLayout:  LayoutDirection;
  onLayoutChange:  (dir: LayoutDirection) => void;
}
```

The sidebar does not accept `filter` as a prop — it reads `useFilter()` and `useSettings()` directly from context.

### 4.3 Internal State

```typescript
interface SidebarState {
  isCollapsed:       boolean;
  themeExpanded:     boolean;   // Theme section collapsed by default
}
```

### 4.4 Component Structure

```typescript
export function Sidebar({ models, enums, edges, selectedLayout, onLayoutChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed]   = useState(false);
  const [themeExpanded, setThemeExpanded] = useState(false);
  const filter   = useFilter();
  const { settings, updateSetting, updateTheme } = useSettings();

  // Precompute connection counts per model for the list
  const connectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    edges.forEach(e => {
      counts[e.source] = (counts[e.source] ?? 0) + 1;
      counts[e.target] = (counts[e.target] ?? 0) + 1;
    });
    return counts;
  }, [edges]);

  if (isCollapsed) return <CollapsedSidebarRail onExpand={() => setIsCollapsed(false)} />;

  return (
    <aside className="sidebar">

      {/* Search */}
      <section className="sidebar-section">
        <SearchInput
          value={filter.searchQuery}
          onChange={filter.setSearchQuery}
          placeholder="Search models..."
        />
      </section>

      {/* Models list */}
      <section className="sidebar-section sidebar-section--scroll">
        <SectionHeader label={`Models (${models.length})`} />
        {models.map(model => (
          <ModelListItem
            key={model.name}
            name={model.name}
            connectionCount={connectionCounts[model.name] ?? 0}
            isHidden={filter.hiddenNodeIds.has(model.name)}
            isFocused={filter.focusedNodeId === model.name}
            onToggleHide={() => filter.toggleHideNode(model.name)}
            onFocus={() =>
              filter.focusedNodeId === model.name
                ? filter.clearFocus()
                : filter.focusNode(model.name)
            }
          />
        ))}
        {enums.length > 0 && (
          <>
            <SectionHeader label={`Enums (${enums.length})`} />
            {enums.map(e => (
              <EnumListItem
                key={e.name}
                name={e.name}
                isHidden={filter.hiddenNodeIds.has(e.name)}
                onToggleHide={() => filter.toggleHideNode(e.name)}
              />
            ))}
          </>
        )}
      </section>

      {/* Layout controls */}
      <section className="sidebar-section">
        <SectionHeader label="Layout" />
        <LayoutDirectionButtons
          selected={selectedLayout}
          onChange={onLayoutChange}
        />
        {filter.focusedNodeId && (
          <FocusDepthSlider
            value={filter.focusDepth}
            onChange={filter.setFocusDepth}
          />
        )}
      </section>

      {/* Visual settings */}
      <section className="sidebar-section">
        <SectionHeader label="Display" />
        <Toggle label="Minimap"       checked={settings.showMinimap}     onChange={v => updateSetting('showMinimap', v)} />
        <Toggle label="Background"    checked={settings.showBackground}  onChange={v => updateSetting('showBackground', v)} />
        <Toggle label="Field types"   checked={settings.showFieldTypes}  onChange={v => updateSetting('showFieldTypes', v)} />
        <Toggle label="Field icons"   checked={settings.showFieldIcons}  onChange={v => updateSetting('showFieldIcons', v)} />
        <BackgroundVariantSelect
          value={settings.backgroundVariant}
          onChange={v => updateSetting('backgroundVariant', v)}
        />
      </section>

      {/* Theme (collapsed by default) */}
      <section className="sidebar-section">
        <CollapsibleHeader
          label="Theme"
          expanded={themeExpanded}
          onToggle={() => setThemeExpanded(v => !v)}
        />
        {themeExpanded && (
          <ThemeColorPickers settings={settings.theme} onChange={updateTheme} />
        )}
      </section>

      <SidebarCollapseButton onClick={() => setIsCollapsed(true)} />
    </aside>
  );
}
```

### 4.5 `ModelListItem` Interface

```typescript
interface ModelListItemProps {
  name:            string;
  connectionCount: number;
  isHidden:        boolean;
  isFocused:       boolean;
  onToggleHide:    () => void;
  onFocus:         () => void;
}
```

The item renders: `[EyeIcon] [FocusIcon] ModelName [badge: connectionCount]`.

- Eye icon toggles between `Eye` and `EyeOff` (Lucide icons already in the project).
- Focus icon: `Crosshair` or `Target` from Lucide — active when `isFocused`.
- Connection count badge: only shown when `connectionCount > 0`.

### 4.6 `LayoutDirectionButtons` Interface

```typescript
type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL';

interface LayoutDirectionButtonsProps {
  selected: LayoutDirection;
  onChange: (dir: LayoutDirection) => void;
}

const LAYOUT_OPTIONS: { dir: LayoutDirection; label: string; icon: LucideIcon }[] = [
  { dir: 'TB', label: 'Top to Bottom', icon: ArrowDown },
  { dir: 'LR', label: 'Left to Right', icon: ArrowRight },
  { dir: 'BT', label: 'Bottom to Top', icon: ArrowUp },
  { dir: 'RL', label: 'Right to Left', icon: ArrowLeft },
];
```

Renders as a 2×2 icon button grid. The selected button gets an accent background.

### 4.7 Layout and CSS

```
┌─────────────────────────────────────────────────────────────┐
│ [≡ collapse]         prisma-generate-uml                    │
├─────────────────────────────────────────────────────────────┤
│ Sidebar (240px fixed, left)  │  ReactFlow canvas (flex-1)  │
│                              │                              │
│  [Search input]              │                              │
│  ─────────────               │                              │
│  Models (12)                 │                              │
│  [👁][⊕] User           3   │                              │
│  [👁][⊕] Post           5   │                              │
│  [👁][⊕] Comment        2   │                              │
│  ...                         │                              │
│  ─────────────               │                              │
│  Layout                      │                              │
│  [↓][→][↑][←]               │                              │
│  ─────────────               │                              │
│  Display                     │                              │
│  □ Minimap  □ Background     │                              │
│  □ Field types □ Field icons │                              │
│  ─────────────               │                              │
│  ▶ Theme (collapsed)         │                              │
└─────────────────────────────────────────────────────────────┘
```

Shell layout uses `display: flex; flex-direction: row` on the outer wrapper. The sidebar is `width: 240px; flex-shrink: 0`. The ReactFlow container is `flex: 1`.

---

## 5. Connection Highlighting

### 5.1 Behavior Specification

| Trigger | Effect |
|---|---|
| Select a node | Dim all non-connected nodes to 30% opacity; highlight connected edges with accent color and increased stroke width |
| Select an edge | Highlight that edge; dim all nodes not connected to that edge |
| Deselect all | Restore all nodes and edges to full opacity / default style |
| Multiple selection | Union of all neighborhoods is highlighted |

### 5.2 `useConnectionHighlight` Hook

```typescript
// lib/hooks/useConnectionHighlight.ts

import { useCallback } from 'react';
import {
  getConnectedEdges,
  useOnSelectionChange,
  useReactFlow,
  type Node,
  type Edge,
} from '@xyflow/react';

const DIM_OPACITY       = 0.2;
const HIGHLIGHT_COLOR   = '#6366f1';  // matches ONE_TO_MANY edge color
const HIGHLIGHT_WIDTH   = 3;

export function useConnectionHighlight() {
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow();

  const highlight = useCallback((selectedNodes: Node[], selectedEdges: Edge[]) => {
    const allNodes = getNodes();
    const allEdges = getEdges();

    if (selectedNodes.length === 0 && selectedEdges.length === 0) {
      // Restore everything
      setNodes(allNodes.map(n => ({ ...n, style: { ...n.style, opacity: 1 } })));
      setEdges(allEdges.map(e => ({ ...e, style: { ...e.style, opacity: 1, strokeWidth: 2 } })));
      return;
    }

    // Find all edges connected to selected nodes
    const connectedEdges  = new Set(getConnectedEdges(selectedNodes, allEdges).map(e => e.id));
    // Add directly selected edges
    selectedEdges.forEach(e => connectedEdges.add(e.id));

    // Find all nodes connected by those edges
    const connectedNodeIds = new Set(selectedNodes.map(n => n.id));
    allEdges.forEach(e => {
      if (connectedEdges.has(e.id)) {
        connectedNodeIds.add(e.source);
        connectedNodeIds.add(e.target);
      }
    });

    setNodes(allNodes.map(n => ({
      ...n,
      style: {
        ...n.style,
        opacity: connectedNodeIds.has(n.id) ? 1 : DIM_OPACITY,
      },
    })));

    setEdges(allEdges.map(e => ({
      ...e,
      style: {
        ...e.style,
        opacity:     connectedEdges.has(e.id) ? 1 : DIM_OPACITY,
        stroke:      connectedEdges.has(e.id) ? HIGHLIGHT_COLOR : undefined,
        strokeWidth: connectedEdges.has(e.id) ? HIGHLIGHT_WIDTH : 2,
      },
    })));
  }, [getNodes, getEdges, setNodes, setEdges]);

  useOnSelectionChange({
    onChange: ({ nodes, edges }) => highlight(nodes, edges),
  });
}
```

### 5.3 Integration

Call `useConnectionHighlight()` inside `SchemaVisualizer` (which is already inside `ReactFlowProvider`). No props needed — it operates on the React Flow store directly.

```typescript
// SchemaVisualizer.tsx
export const SchemaVisualizer = ({ connections, models, enums }: Props) => {
  // ...existing code...
  useConnectionHighlight();  // add this line
  // ...
};
```

### 5.4 Interaction with Filter

The opacity dim from `useConnectionHighlight` is applied via `node.style.opacity`. Filter visibility uses `node.hidden`. These are orthogonal — a hidden node is not rendered at all, so it cannot be dimmed. No conflict.

---

## 6. Edge Redesign

### 6.1 Extending the Type System

The extension backend must communicate relationship type. Extend `ModelConnection` in `schema.ts`:

```typescript
// lib/types/schema.ts

export type RelationType = 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY';

export type ModelConnection = {
  target:        string;
  source:        string;
  name:          string;
  relationType?: RelationType;   // new field — optional for backward compatibility
};
```

The extension (TypeScript/Node.js side) already parses the Prisma schema. It should populate `relationType` when generating `ModelConnection` objects. A `relationType` of `undefined` falls back to the `ONE_TO_MANY` style as a safe default.

### 6.2 Color Coding

| Relationship | Color | Rationale |
|---|---|---|
| `ONE_TO_ONE` | `#10b981` (emerald) | Rare, clean relationship — green feels singular |
| `ONE_TO_MANY` | `#6366f1` (indigo) | Most common — uses the extension's primary accent |
| `MANY_TO_MANY` | `#f59e0b` (amber) | Complex relationship — amber signals complexity |
| Unknown / undefined | `#6366f1` (indigo) | Same as ONE_TO_MANY as safe fallback |

### 6.3 Edge Style Map

```typescript
// lib/utils/edge-styles.ts

import { MarkerType } from '@xyflow/react';
import { RelationType } from '../types/schema';

interface EdgeVisual {
  stroke:      string;
  strokeWidth: number;
  markerEnd:   { type: MarkerType; color: string };
  label?:      string;
}

const EDGE_VISUALS: Record<RelationType, EdgeVisual> = {
  ONE_TO_ONE: {
    stroke:      '#10b981',
    strokeWidth: 2,
    markerEnd:   { type: MarkerType.ArrowClosed, color: '#10b981' },
  },
  ONE_TO_MANY: {
    stroke:      '#6366f1',
    strokeWidth: 2,
    markerEnd:   { type: MarkerType.ArrowClosed, color: '#6366f1' },
  },
  MANY_TO_MANY: {
    stroke:      '#f59e0b',
    strokeWidth: 2,
    markerEnd:   { type: MarkerType.ArrowClosed, color: '#f59e0b' },
  },
};

export function getEdgeVisual(relationType?: RelationType): EdgeVisual {
  return EDGE_VISUALS[relationType ?? 'ONE_TO_MANY'];
}
```

### 6.4 Edge Construction in `SchemaVisualizer`

```typescript
const edges: Edge[] = useMemo(() => {
  return connections.map((connection) => {
    const visual = getEdgeVisual(connection.relationType);
    return {
      id:           `${connection.source}-${connection.target}`,
      source:       connection.source.split('-')[0],
      target:       connection.target.split('-')[0],
      sourceHandle: connection.source,
      targetHandle: connection.target,
      type:         'smoothstep',
      // Remove: animated, strokeDasharray, strokeDashoffset
      style: {
        stroke:      visual.stroke,
        strokeWidth: visual.strokeWidth,
      },
      markerEnd:    visual.markerEnd,
      // Optional relationship label
      label:        connection.name || undefined,
      labelStyle:   { fontSize: 10, fill: visual.stroke },
      labelBgStyle: { fill: 'transparent' },
    };
  });
}, [connections]);
```

### 6.5 Removing the Dashed Style

The current code sets `strokeDasharray: '5'` unconditionally. Remove all of:

```typescript
// DELETE these from edge style:
strokeDasharray:  '5',
strokeDashoffset: 0,
strokeOpacity:    0.5,
// and the conditional black/white stroke color
stroke: isDarkMode ? '#ffffff' : '#000000',
```

Replace with the relationship-type-driven color from `getEdgeVisual`.

---

## 7. Node Card Redesign

### 7.1 Dynamic Sizing Strategy

| Property | Current | Target |
|---|---|---|
| `min-width` | `250px` hardcoded | `200px` |
| `max-width` | none (overflows) | `320px` |
| `width` | implicit 250px | `auto` (content-driven) |
| Height | 400px assumed by dagre | Measured by React Flow after render |

With `useNodesInitialized`, dagre will receive the actual rendered height. The `auto` width means the card grows to fit the widest field name + type string, capped at `320px`.

### 7.2 Revised `ModelNode` Structure

```typescript
export const ModelNode = memo(({ data, selected }: NodeProps<ModelNodeTye>) => {
  const { isDarkMode }  = useTheme();
  const { settings }    = useSettings();

  const connectionCount = data.fields.filter(f => f.hasConnections).length;
  const pkFields        = new Set(['id', 'uuid']); // heuristic; extend as needed

  return (
    <div
      className={[
        'model-node',
        isDarkMode ? 'model-node--dark' : 'model-node--light',
        selected  ? 'model-node--selected' : '',
      ].join(' ')}
    >
      {/* Target handle — always present (any node can be a relation target) */}
      <Handle id={`${data.name}-target`} position={Position.Top} type="target" />

      {/* Header */}
      <div className="model-node__header" style={{ background: headerGradient(settings) }}>
        <TableIcon size={14} />
        <span className="model-node__title">{data.name}</span>
        {connectionCount > 0 && (
          <span className="model-node__badge">{connectionCount}</span>
        )}
      </div>

      {/* Fields */}
      <div className="model-node__fields">
        {data.fields.map(({ type, name, hasConnections }) => (
          <div key={name} className="model-node__field">
            {pkFields.has(name.toLowerCase()) && <KeyIcon size={12} className="pk-icon" />}
            {settings.showFieldIcons && <span className="field-icon">{getIconForType(type)}</span>}
            <span className="field-name">{name}</span>
            {settings.showFieldTypes && (
              <span className="field-type">{type}</span>
            )}
            {hasConnections && (
              <Handle
                position={Position.Right}
                id={`${data.name}-${name}-source`}
                type="source"
                className="field-handle"
                // No top offset — handle is inside the field row (position: relative)
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
```

### 7.3 CSS for the Node Card

```css
.model-node {
  min-width: 200px;
  max-width: 320px;
  width:     auto;
  border-radius: 0.75rem;
  border:    1px solid transparent;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  overflow:  hidden;
  transition: box-shadow 0.2s, border-color 0.2s;
}

.model-node--selected {
  border-color: #6366f1;
  box-shadow:   0 0 0 2px #6366f1, 0 4px 16px rgba(99,102,241,0.3);
}

.model-node__header {
  display:     flex;
  align-items: center;
  gap:         6px;
  padding:     8px 10px;
}

.model-node__title {
  font-weight:    600;
  font-size:      0.875rem;
  white-space:    nowrap;
  overflow:       hidden;
  text-overflow:  ellipsis;
  flex:           1;
}

.model-node__badge {
  font-size:     0.7rem;
  background:    rgba(255,255,255,0.2);
  border-radius: 9999px;
  padding:       1px 6px;
}

.model-node__field {
  position:    relative;   /* scopes the absolute Handle */
  display:     flex;
  align-items: center;
  gap:         6px;
  padding:     5px 10px;
  font-size:   0.8125rem;
}

.field-name  { flex: 1; white-space: nowrap; }
.field-type  { color: var(--muted); font-size: 0.75rem; margin-left: auto; }
.pk-icon     { color: #f59e0b; flex-shrink: 0; }

/* Handle positioned relative to its own row — no index math */
.field-handle {
  position:  absolute !important;
  right:     -5px;
  top:       50%;
  transform: translateY(-50%);
}
```

### 7.4 Selected State

React Flow passes `selected: boolean` as a prop to custom nodes. Apply `model-node--selected` class when `selected === true`. This replaces any need for external click handling for visual feedback.

---

## 8. Implementation Roadmap

Changes are ordered by impact (bugs fixed / value delivered per effort unit).

### Priority 1 — Critical: Fix Layout Correctness

These changes eliminate node overlap and stale-state bugs. They are prerequisites for everything else.

| # | Change | Files Affected |
|---|---|---|
| 1.1 | Rewrite `getLayoutedElements` to create a new dagre graph instance per call, add full config (`ranker`, `acyclicer`, `nodesep`, `ranksep`, `marginx`, `marginy`) | `lib/utils/layout-utils.ts` |
| 1.2 | Integrate `useNodesInitialized` in `useGraph` — delay layout until React Flow has measured all nodes | `lib/hooks/useGraph.ts` |
| 1.3 | Pass `node.measured?.width` and `node.measured?.height` to dagre instead of the hardcoded constants | `lib/utils/layout-utils.ts` |
| 1.4 | Fix handle position: remove `style={{ top: 27 + 16 + 27 * index }}` — use CSS `position: relative` on field rows and `position: absolute` on handles | `components/ModelNode.tsx` |

### Priority 2 — High: Filtering and Focus

These features make large schemas navigable. Blocked only by Priority 1 being stable.

| # | Change | Files Affected |
|---|---|---|
| 2.1 | Create `FilterContext` and `FilterProvider` with `focusedNodeId`, `searchQuery`, `hiddenNodeIds`, `focusDepth` and all action functions | `lib/contexts/filter.tsx` (new), `lib/types/filter.ts` (new) |
| 2.2 | Implement `bfsNeighbors` utility and `applyFilter` function | `lib/utils/graph-utils.ts` (new) |
| 2.3 | Integrate filter in `useGraph` — apply `node.hidden` and `edge.hidden` before passing to React Flow | `lib/hooks/useGraph.ts` |
| 2.4 | Add `FilterProvider` to the provider tree in `App.tsx` | `App.tsx` |

### Priority 3 — High: New Sidebar (replace Leva)

Depends on Priority 2 because the sidebar exposes filter actions.

| # | Change | Files Affected |
|---|---|---|
| 3.1 | Build `Sidebar` component with Search, Models list, Layout controls, Visual toggles, Theme section | `components/Sidebar.tsx` (new) |
| 3.2 | Build `ModelListItem` with eye/focus icons and connection count badge | inside `Sidebar.tsx` or `components/ModelListItem.tsx` |
| 3.3 | Replace `<SettingsPanel />` with `<Sidebar />` in `SchemaVisualizer`; wire `onLayoutChange` | `components/SchemaVisualizer.tsx` |
| 3.4 | Remove `leva` package from dependencies | `packages/webview-ui/package.json` |
| 3.5 | Adjust shell layout to `flex-row` so sidebar sits left of canvas | `components/SchemaVisualizer.tsx` (CSS) |

### Priority 4 — Medium: Connection Highlighting

Standalone hook; no dependencies on sidebar or filter.

| # | Change | Files Affected |
|---|---|---|
| 4.1 | Implement `useConnectionHighlight` using `useOnSelectionChange` + `getConnectedEdges` | `lib/hooks/useConnectionHighlight.ts` (new) |
| 4.2 | Call `useConnectionHighlight()` in `SchemaVisualizer` | `components/SchemaVisualizer.tsx` |

### Priority 5 — Medium: Edge Visual Redesign

| # | Change | Files Affected |
|---|---|---|
| 5.1 | Extend `ModelConnection` type with optional `relationType: RelationType` | `lib/types/schema.ts` |
| 5.2 | Implement `getEdgeVisual()` utility | `lib/utils/edge-styles.ts` (new) |
| 5.3 | Remove dashed style; apply color-coded solid edges with arrow markers | `components/SchemaVisualizer.tsx` |
| 5.4 | Update extension backend to populate `relationType` on connection objects | `src/` (extension side, outside webview-ui) |

### Priority 6 — Medium: Node Card Redesign

| # | Change | Files Affected |
|---|---|---|
| 6.1 | Replace `min-w-[250px]` with `min-w-[200px] max-w-[320px] w-auto` | `components/ModelNode.tsx` |
| 6.2 | Add `selected` ring using React Flow's `selected` prop | `components/ModelNode.tsx` |
| 6.3 | Add connection count badge to model header | `components/ModelNode.tsx` |
| 6.4 | Add primary key indicator (key icon on `id` / `pk` fields) | `components/ModelNode.tsx` |
| 6.5 | Apply same `max-width` cap to `EnumNode` | `components/EnumNode.tsx` |

### Priority 7 — Low: Polish

| # | Change | Files Affected |
|---|---|---|
| 7.1 | Add `FocusDepthSlider` in sidebar (visible only when a node is focused) | `components/Sidebar.tsx` |
| 7.2 | Animate node appearance after initial layout (fade-in via CSS transition) | `components/ModelNode.tsx` |
| 7.3 | Persist sidebar collapse state in `localStorage` | `components/Sidebar.tsx` |
| 7.4 | Add `RelationEdge` custom edge type with inline label for relationship name | `components/edges/RelationEdge.tsx` (new), `components/SchemaVisualizer.tsx` |
| 7.5 | Keyboard shortcut: `Escape` to clear focus/search | `components/SchemaVisualizer.tsx` |

### Summary Table

| Priority | Category | Estimated Files Changed | Complexity |
|---|---|---|---|
| 1 — Critical | Layout engine | 2 modified | Low |
| 2 — High | Filtering system | 3 new, 2 modified | Medium |
| 3 — High | Sidebar | 2 new, 2 modified | Medium |
| 4 — Medium | Connection highlighting | 1 new, 1 modified | Low |
| 5 — Medium | Edge redesign | 2 new, 2 modified | Low-Medium |
| 6 — Medium | Node card | 2 modified | Low |
| 7 — Low | Polish | 2 new, 3 modified | Low |

---

## Appendix: Dependency Notes

- `leva` can be removed after Priority 3 is complete. It is only imported in `SettingsPanel.tsx`.
- `@dagrejs/dagre` v3 and `@xyflow/react` v12 are already installed. No new graph or layout dependencies are needed.
- `lucide-react` is already in the project (used in `ModelNode.tsx`). The sidebar can use `Eye`, `EyeOff`, `Crosshair`, `ArrowDown`, `ArrowRight`, `ArrowUp`, `ArrowLeft`, `Table2`, `Key` from the same package.
- No new runtime dependencies are required for any of the changes in this document.
