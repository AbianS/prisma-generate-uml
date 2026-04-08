import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import { Edge, Position } from '@xyflow/react';
import { MyNode, Model } from '../types/schema';

export type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL';

const FALLBACK_NODE_WIDTH = 220;
const FALLBACK_NODE_HEIGHT = 120;

const ELK_DIRECTION: Record<LayoutDirection, string> = {
  LR: 'RIGHT',
  RL: 'LEFT',
  TB: 'DOWN',
  BT: 'UP',
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
  const isHorizontal = direction === 'LR' || direction === 'RL';

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
        layoutOptions: { 'port.side': isHorizontal ? 'WEST' : 'NORTH' },
      });
      node.data.fields
        .filter((f) => f.hasConnections)
        .forEach((f) => {
          ports.push({
            id: `${node.id}-${f.name}-source`,
            layoutOptions: { 'port.side': isHorizontal ? 'EAST' : 'SOUTH' },
          });
        });
      // Enum relation ports
      node.data.fields
        .filter((f) => f.isEnum)
        .forEach((f) => {
          ports.push({
            id: `${node.id}-${f.name}-enum-source`,
            layoutOptions: { 'port.side': isHorizontal ? 'EAST' : 'SOUTH' },
          });
        });
    } else if (isEnumData(node.data)) {
      ports.push({
        id: `${node.id}-target`,
        layoutOptions: { 'port.side': isHorizontal ? 'WEST' : 'NORTH' },
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

  const layoutedNodes = nodes.map((node) => {
    const pos = nodePositions.get(node.id);
    if (node.hidden || !pos) return node;
    return {
      ...node,
      position: pos,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
    };
  });

  return { nodes: layoutedNodes, edges };
}
