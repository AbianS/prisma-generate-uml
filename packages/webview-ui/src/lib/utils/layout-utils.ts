import dagre from '@dagrejs/dagre';
import { Edge, Position } from '@xyflow/react';
import { MyNode } from '../types/schema';

export type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL';

const FALLBACK_NODE_WIDTH = 220;
const FALLBACK_NODE_HEIGHT = 36;

export function getLayoutedElements(
  nodes: MyNode[],
  edges: Edge[],
  direction: LayoutDirection = 'LR',
) {
  // Always create a fresh instance — never reuse a module-level singleton
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    ranker: 'network-simplex',
    acyclicer: 'greedy',
    nodesep: 60,
    ranksep: 140,
    marginx: 50,
    marginy: 50,
  });

  const isHorizontal = direction === 'LR' || direction === 'RL';
  const visibleNodes = nodes.filter((n) => !n.hidden);

  visibleNodes.forEach((node) => {
    g.setNode(node.id, {
      // Use React Flow's measured dimensions when available; fall back to safe defaults
      width: node.measured?.width ?? FALLBACK_NODE_WIDTH,
      height: node.measured?.height ?? FALLBACK_NODE_HEIGHT,
    });
  });

  edges
    .filter((e) => !e.hidden)
    .forEach((edge) => {
      // Only add edges where both endpoints are visible nodes
      if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
        g.setEdge(edge.source, edge.target);
      }
    });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    if (node.hidden || !g.hasNode(node.id)) return node;
    const { x, y, width, height } = g.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        // Dagre returns center coordinates; React Flow expects top-left corner
        x: x - width / 2,
        y: y - height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
