import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ControlButton,
  Controls,
  Edge,
  MiniMap,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import { useMemo } from 'react';
import { useFilter } from '../lib/contexts/filter';
import { useSettings } from '../lib/contexts/settings';
import { useTheme } from '../lib/contexts/theme';
import { useConnectionHighlight } from '../lib/hooks/useConnectionHighlight';
import { useGraph } from '../lib/hooks/useGraph';
import {
  Enum,
  Model,
  ModelConnection,
  MyNode,
  RelationType,
} from '../lib/types/schema';
import { maskColor, nodeColor, nodeStrokeColor } from '../lib/utils/colots';
import { bfsNeighbors } from '../lib/utils/graph-utils';
import { screenshot } from '../lib/utils/screnshot';
import { EnumNode } from './EnumNode';
import { ModelNode } from './ModelNode';
import { Sidebar } from './Sidebar';
import { RelationEdge } from './edges/RelationEdge';
import { IDownload } from './icons/IDownload';

interface Props {
  models: Model[];
  connections: ModelConnection[];
  enums: Enum[];
}

const NODE_TYPES = { model: ModelNode, enum: EnumNode };
const EDGE_TYPES = { relation: RelationEdge };

export const SchemaVisualizer = ({ connections, models, enums }: Props) => {
  const { isDarkMode } = useTheme();
  const { getNodes } = useReactFlow();
  const { settings } = useSettings();
  const filter = useFilter();

  // ── Build raw nodes ────────────────────────────────────────────────────
  const enumNames = useMemo(() => new Set(enums.map((e) => e.name)), [enums]);

  const allModelNodes = useMemo<MyNode[]>(
    () =>
      models.map((model) => ({
        id: model.name,
        data: {
          ...model,
          fields: model.fields.map((f) => ({
            ...f,
            isEnum: enumNames.has(f.type),
          })),
        },
        type: 'model' as const,
        position: { x: 0, y: 0 },
      })),
    [models, enumNames],
  );

  const allEnumNodes = useMemo<MyNode[]>(
    () =>
      enums.map((enumItem) => ({
        id: enumItem.name,
        data: enumItem,
        type: 'enum' as const,
        position: { x: 0, y: 0 },
      })),
    [enums],
  );

  const allEdges = useMemo<Edge[]>(() => {
    // Group connections by sorted node-pair to detect bidirectional relations.
    // Prisma always defines both sides of a relation, so A→B and B→A appear as
    // two separate connections. We merge them into one edge with arrows on both
    // ends to avoid ELK treating one as a back-edge (which causes U-turns).
    const pairMap = new Map<string, typeof connections>();
    connections.forEach((conn) => {
      const src = conn.source.split('-')[0];
      const tgt = conn.target.split('-')[0];
      if (src === tgt) return; // skip self-loops
      const key = [src, tgt].sort().join('|||');
      if (!pairMap.has(key)) pairMap.set(key, []);
      pairMap.get(key)!.push(conn);
    });

    const edges: Edge[] = [];
    const seen = new Set<string>();

    connections.forEach((connection) => {
      const sourceNodeId = connection.source.split('-')[0];
      const targetNodeId = connection.target.split('-')[0];
      if (sourceNodeId === targetNodeId) return;
      const key = [sourceNodeId, targetNodeId].sort().join('|||');
      if (seen.has(key)) return;
      seen.add(key);

      const pair = pairMap.get(key)!;
      const bidirectional = pair.length > 1;

      edges.push({
        id: `${connection.source}-${connection.target}`,
        source: sourceNodeId,
        target: targetNodeId,
        sourceHandle: connection.source,
        targetHandle: connection.target,
        type: 'relation',
        data: {
          relationType: (connection.relationType ?? undefined) as
            | RelationType
            | undefined,
          label: connection.name,
          bidirectional,
        },
        style: { transition: 'opacity 0.2s ease' },
      });
    });

    // ── Enum edges: model field → enum node ──────────────────────────────
    models.forEach((model) => {
      model.fields.forEach((field) => {
        if (!enumNames.has(field.type)) return;
        edges.push({
          id: `${model.name}-${field.name}-enum-${field.type}`,
          source: model.name,
          target: field.type,
          sourceHandle: `${model.name}-${field.name}-enum-source`,
          targetHandle: `${field.type}-target`,
          type: 'relation',
          data: { label: field.name },
          style: { transition: 'opacity 0.2s ease' },
        });
      });
    });

    return edges;
  }, [connections, models, enumNames]);

  // ── Apply filter (focus + search + manual hide) ────────────────────────
  const { filteredNodes, filteredEdges } = useMemo(() => {
    const allNodes = [...allModelNodes, ...allEnumNodes];
    const query = filter.searchQuery.trim().toLowerCase();

    // Compute focus-visible set via BFS
    let focusIds: Set<string> | null = null;
    if (filter.focusedNodeId) {
      focusIds = bfsNeighbors(
        filter.focusedNodeId,
        allEdges,
        filter.focusDepth,
      );
    }

    const fNodes = allNodes.map((node) => {
      const matchesSearch = !query || node.id.toLowerCase().includes(query);
      const matchesFocus = !focusIds || focusIds.has(node.id);
      const notHidden = !filter.hiddenNodeIds.has(node.id);
      return { ...node, hidden: !(matchesSearch && matchesFocus && notHidden) };
    });

    const visibleNodeIds = new Set(
      fNodes.filter((n) => !n.hidden).map((n) => n.id),
    );
    const fEdges = allEdges.map((edge) => ({
      ...edge,
      hidden:
        !visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target),
    }));

    return { filteredNodes: fNodes, filteredEdges: fEdges };
  }, [
    allModelNodes,
    allEnumNodes,
    allEdges,
    filter.focusedNodeId,
    filter.focusDepth,
    filter.searchQuery,
    filter.hiddenNodeIds,
  ]);

  // ── Layout ─────────────────────────────────────────────────────────────
  const {
    nodes,
    edges: edgesState,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onLayout,
    selectedLayout,
  } = useGraph(filteredNodes, filteredEdges);

  // ── Connection highlighting on selection ───────────────────────────────
  useConnectionHighlight();

  // ── Background variant ─────────────────────────────────────────────────
  const bgVariant = useMemo(() => {
    switch (settings.backgroundVariant) {
      case 'dots':
        return BackgroundVariant.Dots;
      case 'cross':
        return BackgroundVariant.Cross;
      default:
        return BackgroundVariant.Lines;
    }
  }, [settings.backgroundVariant]);

  const containerStyle = {
    '--primary-color': settings.theme.primaryColor,
    '--secondary-color': settings.theme.secondaryColor,
    '--title-color': settings.theme.titleColor,
    '--background-color':
      settings.theme.backgroundColor || (isDarkMode ? '#111111' : '#f5f5f5'),
  } as React.CSSProperties;

  return (
    <div
      className="h-[100vh] w-full flex flex-row dynamic-background"
      style={containerStyle}
    >
      {/* ── Sidebar ── */}
      <Sidebar
        models={models}
        enums={enums}
        edges={edgesState}
        selectedLayout={selectedLayout}
        onLayoutChange={onLayout}
      />

      {/* ── Canvas ── */}
      <div className="flex-1 relative overflow-hidden">
        <ReactFlow
          onlyRenderVisibleElements
          colorMode={isDarkMode ? 'dark' : 'light'}
          nodes={nodes}
          edges={edgesState}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          connectionLineType={ConnectionLineType.SmoothStep}
          minZoom={0.05}
          maxZoom={2}
        >
          <Controls>
            <ControlButton
              title="Download Screenshot"
              onClick={() => screenshot(getNodes)}
            >
              <IDownload color={isDarkMode ? 'white' : 'black'} />
            </ControlButton>
          </Controls>

          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            nodeColor={nodeColor(isDarkMode)}
            nodeStrokeColor={nodeStrokeColor(isDarkMode)}
            maskColor={maskColor(isDarkMode)}
            style={{
              backgroundColor: settings.theme.backgroundColor,
              display: settings.showMinimap ? 'block' : 'none',
            }}
          />

          <Background
            color={isDarkMode ? '#232323' : '#e4e4e4'}
            gap={32}
            lineWidth={0.5}
            variant={bgVariant}
            style={{
              opacity: settings.showBackground ? 1 : 0,
              pointerEvents: settings.showBackground ? 'auto' : 'none',
            }}
          />
        </ReactFlow>
      </div>
    </div>
  );
};
