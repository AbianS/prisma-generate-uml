import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addEdge,
  Connection,
  ConnectionLineType,
  Edge,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import {
  getLayoutedElements,
  type LayoutDirection,
} from '../utils/layout-utils';
import { MyNode } from '../types/schema';

const DEFAULT_LAYOUT: LayoutDirection = 'LR';

export const useGraph = (initialNodes: MyNode[], initialEdges: Edge[]) => {
  const { fitView, getNodes } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<MyNode>(
    initialNodes.map((n) => ({ ...n, style: { opacity: 0 } })),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedLayout, setSelectedLayout] =
    useState<LayoutDirection>(DEFAULT_LAYOUT);

  // nodesInitialized becomes true after React Flow has measured all visible nodes
  const nodesInitialized = useNodesInitialized({ includeHiddenNodes: false });

  // Track whether a layout pass is pending
  const needsLayoutRef = useRef(true);

  // Track the previous input signature to detect changes
  const prevSignatureRef = useRef('');

  // When input nodes/edges change, reset positions and flag for re-layout
  useEffect(() => {
    if (!initialNodes.length && !initialEdges.length) return;

    const signature =
      initialNodes.map((n) => n.id + (n.hidden ? ':h' : '')).join(',') +
      '|' +
      initialEdges.map((e) => e.id).join(',');

    if (signature === prevSignatureRef.current) return;
    prevSignatureRef.current = signature;

    setNodes(
      initialNodes.map((n) => ({
        ...n,
        position: { x: 0, y: 0 },
        style: { ...n.style, opacity: 0 },
      })),
    );
    setEdges(initialEdges);
    needsLayoutRef.current = true;
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Run layout once React Flow has measured all visible nodes
  useEffect(() => {
    if (!nodesInitialized || !needsLayoutRef.current) return;
    needsLayoutRef.current = false;

    const measuredNodes = getNodes() as MyNode[];
    const { nodes: laid, edges: laidEdges } = getLayoutedElements(
      measuredNodes,
      edges,
      selectedLayout,
    );

    setNodes(laid.map((n) => ({ ...n, style: { ...n.style, opacity: 1 } })));
    setEdges(laidEdges);

    setTimeout(
      () => fitView({ padding: 0.15, minZoom: 0.05, duration: 600 }),
      50,
    );
    // intentionally omitting nodes/edges/selectedLayout from deps to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesInitialized]);

  const onLayout = useCallback(
    (direction: LayoutDirection) => {
      setSelectedLayout(direction);
      const { nodes: laid, edges: laidEdges } = getLayoutedElements(
        nodes,
        edges,
        direction,
      );
      setNodes(laid);
      setEdges(laidEdges);
      setTimeout(
        () => fitView({ padding: 0.15, minZoom: 0.05, duration: 600 }),
        50,
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
