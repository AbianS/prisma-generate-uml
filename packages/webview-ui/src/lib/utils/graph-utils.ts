import { Edge } from '@xyflow/react';

/**
 * Returns the set of node IDs reachable from `startId` within `depth` hops,
 * traversing edges in both directions (undirected BFS).
 */
export function bfsNeighbors(
  startId: string,
  edges: Edge[],
  depth: number,
): Set<string> {
  const visited = new Set([startId]);
  let frontier = new Set([startId]);

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
    next.forEach((id) => visited.add(id));
    frontier = next;
    if (frontier.size === 0) break;
  }

  return visited;
}
