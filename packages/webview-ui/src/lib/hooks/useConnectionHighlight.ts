import { useCallback } from 'react';
import {
  getConnectedEdges,
  useOnSelectionChange,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';

const DIM_OPACITY = 0.15;

export function useConnectionHighlight() {
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow();

  const highlight = useCallback(
    (selectedNodes: Node[], selectedEdges: Edge[]) => {
      const allNodes = getNodes();
      const allEdges = getEdges();

      if (selectedNodes.length === 0 && selectedEdges.length === 0) {
        // Restore all to full opacity
        setNodes(
          allNodes.map((n) => ({ ...n, style: { ...n.style, opacity: 1 } })),
        );
        setEdges(
          allEdges.map((e) => ({
            ...e,
            style: { ...e.style, opacity: 1 },
          })),
        );
        return;
      }

      // Collect all edges touching selected nodes
      const connectedEdgeIds = new Set(
        getConnectedEdges(selectedNodes, allEdges).map((e) => e.id),
      );
      // Also include directly selected edges
      selectedEdges.forEach((e) => connectedEdgeIds.add(e.id));

      // Collect node IDs that are connected
      const connectedNodeIds = new Set(selectedNodes.map((n) => n.id));
      allEdges.forEach((e) => {
        if (connectedEdgeIds.has(e.id)) {
          connectedNodeIds.add(e.source);
          connectedNodeIds.add(e.target);
        }
      });

      setNodes(
        allNodes.map((n) => ({
          ...n,
          style: {
            ...n.style,
            opacity: connectedNodeIds.has(n.id) ? 1 : DIM_OPACITY,
          },
        })),
      );

      setEdges(
        allEdges.map((e) => ({
          ...e,
          style: {
            ...e.style,
            opacity: connectedEdgeIds.has(e.id) ? 1 : DIM_OPACITY,
          },
        })),
      );
    },
    [getNodes, getEdges, setNodes, setEdges],
  );

  useOnSelectionChange({
    onChange: ({ nodes, edges }) => highlight(nodes, edges),
  });
}
