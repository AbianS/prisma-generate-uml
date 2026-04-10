import {
  Connection,
  ConnectionLineType,
  Edge,
  addEdge,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MyNode } from '../types/schema';
import {
  type LayoutDirection,
  getLayoutedElements,
} from '../utils/layout-utils';

const DEFAULT_LAYOUT: LayoutDirection = 'LR';

export const useGraph = (initialNodes: MyNode[], initialEdges: Edge[]) => {
  const { fitView, getNodes } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<MyNode>(
    initialNodes.map((n) => ({ ...n, style: { opacity: 0 } })),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialEdges.map((e) => ({ ...e, style: { ...e.style, opacity: 0 } })),
  );
  const [selectedLayout, setSelectedLayout] =
    useState<LayoutDirection>(DEFAULT_LAYOUT);

  // nodesInitialized becomes true after React Flow has measured all visible nodes
  const nodesInitialized = useNodesInitialized({ includeHiddenNodes: false });

  // Track whether a layout pass is pending (ref guards against double-run)
  const needsLayoutRef = useRef(true);

  // State counter used ONLY for edge-only changes: when nodes don't change,
  // nodesInitialized never cycles (nothing to re-measure), so we need another
  // way to wake up the layout effect.
  const [layoutVersion, setLayoutVersion] = useState(0);

  // Track the previous node signature to detect whether nodes actually changed.
  // Only ids + hidden flag matter here — if those change, nodesInitialized will
  // cycle on its own and we must NOT also bump layoutVersion (which would run
  // the layout before React Flow finishes measuring the newly visible nodes).
  const prevNodeSigRef = useRef('');

  // When input nodes/edges change, reset positions and flag for re-layout.
  useEffect(() => {
    const nodeSig = initialNodes
      .map((n) => n.id + (n.hidden ? ':h' : ''))
      .join(',');
    const nodesChanged = nodeSig !== prevNodeSigRef.current;
    prevNodeSigRef.current = nodeSig;

    setNodes(
      initialNodes.map((n) => ({
        ...n,
        position: { x: 0, y: 0 },
        style: { ...n.style, opacity: 0 },
      })),
    );
    setEdges(
      initialEdges.map((e) => ({ ...e, style: { ...e.style, opacity: 0 } })),
    );
    needsLayoutRef.current = true;

    // For node changes (focus toggle, hide/show, search) nodesInitialized will
    // cycle false→true once React Flow measures the newly visible nodes — that
    // is enough to trigger the layout effect, and it guarantees measured sizes
    // are ready. Bumping layoutVersion here would fire the layout too early
    // (before measuring) and cause node overlaps.
    //
    // For edge-only changes nodesInitialized never cycles, so we need the bump.
    if (!nodesChanged) {
      setLayoutVersion((v) => v + 1);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Run ELK layout once React Flow has measured all visible nodes.
  // layoutVersion handles the edge-only case where nodesInitialized stays true.
  useEffect(() => {
    if (!nodesInitialized || !needsLayoutRef.current) return;
    needsLayoutRef.current = false;

    const measuredNodes = getNodes() as MyNode[];

    getLayoutedElements(measuredNodes, edges, selectedLayout).then(
      ({ nodes: laid, edges: laidEdges }) => {
        setNodes(
          laid.map((n) => ({ ...n, style: { ...n.style, opacity: 1 } })),
        );
        setEdges(
          laidEdges.map((e) => ({ ...e, style: { ...e.style, opacity: 1 } })),
        );
        setTimeout(
          () => fitView({ padding: 0.15, minZoom: 0.05, duration: 600 }),
          50,
        );
      },
    );
    // intentionally omitting nodes/edges/selectedLayout from deps to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesInitialized, layoutVersion]);

  const onLayout = useCallback(
    (direction: LayoutDirection) => {
      setSelectedLayout(direction);
      getLayoutedElements(nodes, edges, direction).then(
        ({ nodes: laid, edges: laidEdges }) => {
          setNodes(laid);
          setEdges(
            laidEdges.map((e) => ({ ...e, style: { ...e.style, opacity: 1 } })),
          );
          setTimeout(
            () => fitView({ padding: 0.15, minZoom: 0.05, duration: 600 }),
            50,
          );
        },
      );
    },
    [nodes, edges, setNodes, setEdges, fitView],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge({ ...params, type: ConnectionLineType.SmoothStep }, eds),
      );
    },
    [setEdges],
  );

  // Remove the React Flow attribution badge
  useEffect(() => {
    const el = document.querySelector('.react-flow__attribution');
    el?.remove();
  }, []);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onLayout,
    setNodes,
    setEdges,
    selectedLayout,
  };
};
