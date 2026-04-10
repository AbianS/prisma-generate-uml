import { Edge, Position } from '@xyflow/react';
import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import { Model, MyNode } from '../types/schema';

export type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL';

const FALLBACK_NODE_WIDTH = 220;
const FALLBACK_NODE_HEIGHT = 120;

const ELK_DIRECTION: Record<LayoutDirection, string> = {
  LR: 'RIGHT',
  RL: 'LEFT',
  TB: 'DOWN',
  BT: 'UP',
};

// Per-direction ELK port sides and React Flow handle positions
const PORT_SIDES: Record<LayoutDirection, { source: string; target: string }> =
  {
    LR: { source: 'EAST', target: 'WEST' },
    RL: { source: 'WEST', target: 'EAST' },
    TB: { source: 'SOUTH', target: 'NORTH' },
    BT: { source: 'NORTH', target: 'SOUTH' },
  };

const HANDLE_POSITIONS: Record<
  LayoutDirection,
  { source: Position; target: Position }
> = {
  LR: { source: Position.Right, target: Position.Left },
  RL: { source: Position.Left, target: Position.Right },
  TB: { source: Position.Bottom, target: Position.Top },
  BT: { source: Position.Top, target: Position.Bottom },
};

function isModelData(data: unknown): data is Model {
  return (
    typeof data === 'object' &&
    data !== null &&
    'fields' in data &&
    Array.isArray((data as Model).fields)
  );
}

function isEnumData(data: unknown): data is { name: string; values: string[] } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'values' in data &&
    Array.isArray((data as { values: unknown }).values)
  );
}

export async function getLayoutedElements(
  nodes: MyNode[],
  edges: Edge[],
  direction: LayoutDirection = 'LR',
): Promise<{ nodes: MyNode[]; edges: Edge[] }> {
  const elk = new ELK();
  const portSides = PORT_SIDES[direction];

  const visibleNodes = nodes.filter((n) => !n.hidden);
  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = edges.filter(
    (e) =>
      !e.hidden && visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target),
  );

  const elkChildren: ElkNode[] = visibleNodes.map((node) => {
    const width = node.measured?.width ?? FALLBACK_NODE_WIDTH;
    const height = node.measured?.height ?? FALLBACK_NODE_HEIGHT;

    const ports: ElkNode['ports'] = [];

    if (isModelData(node.data)) {
      ports.push({
        id: `${node.id}-target`,
        layoutOptions: { 'port.side': portSides.target },
      });
      node.data.fields
        .filter((f) => f.hasConnections)
        .forEach((f) => {
          ports.push({
            id: `${node.id}-${f.name}-source`,
            layoutOptions: { 'port.side': portSides.source },
          });
        });
      // Enum relation ports
      node.data.fields
        .filter((f) => f.isEnum)
        .forEach((f) => {
          ports.push({
            id: `${node.id}-${f.name}-enum-source`,
            layoutOptions: { 'port.side': portSides.source },
          });
        });
    } else if (isEnumData(node.data)) {
      ports.push({
        id: `${node.id}-target`,
        layoutOptions: { 'port.side': portSides.target },
      });
    }

    return {
      id: node.id,
      width,
      height,
      layoutOptions: { 'org.eclipse.elk.portConstraints': 'FIXED_SIDE' },
      ports,
    };
  });

  const elkEdges = visibleEdges.map((edge) => ({
    id: edge.id,
    sources: [edge.sourceHandle ?? edge.source],
    targets: [edge.targetHandle ?? edge.target],
  }));

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': ELK_DIRECTION[direction],
      'elk.spacing.nodeNode': '80',
      'elk.layered.spacing.nodeNodeBetweenLayers': '180',
      'elk.layered.spacing.edgeNodeBetweenLayers': '60',
      'elk.spacing.edgeNode': '25',
      'elk.spacing.edgeEdge': '15',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.thoroughness': '10',
    },
    children: elkChildren,
    edges: elkEdges,
  };

  const laid = await elk.layout(graph);

  const nodePositions = new Map(
    (laid.children ?? []).map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]),
  );

  const handlePositions = HANDLE_POSITIONS[direction];

  const layoutedNodes = nodes.map((node) => {
    const pos = nodePositions.get(node.id);
    if (node.hidden || !pos) return node;
    return {
      ...node,
      position: pos,
      targetPosition: handlePositions.target,
      sourcePosition: handlePositions.source,
    };
  });

  return { nodes: layoutedNodes, edges };
}
