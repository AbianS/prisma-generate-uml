import equal from 'fast-deep-equal';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getLayoutedElements } from '../utils/layout-utils';
import {
  addEdge,
  Connection,
  ConnectionLineType,
  Edge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { MyNode } from '../types/schema';

const DEFAULT_LAYOUT = 'TB';

export const useGraph = (initialNodes: MyNode[], initialEdges: Edge[]) => {
  const { fitView } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [selectedLayout, setSelectedLayout] = useState<string>(DEFAULT_LAYOUT);

  const [shouldFitView, setShouldFitView] = useState(false);

  const isFirstRender = useRef(true);

  const applyLayout = useCallback(
    (layoutDirection: string, fromNodes = nodes, fromEdges = edges) => {
      const { nodes: layoutedNodes, edges: layoutedEdges } =
        getLayoutedElements(fromNodes, fromEdges, layoutDirection);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setShouldFitView(true);
    },
    [nodes, edges, setNodes, setEdges],
  );

  const onLayout = useCallback(
    (direction: string) => {
      applyLayout(direction);
      setSelectedLayout(direction);
    },
    [applyLayout],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: ConnectionLineType.SmoothStep,
            animated: true,
          },
          eds,
        ),
      );
    },
    [setEdges],
  );

  useEffect(() => {
    if (!initialNodes?.length && !initialEdges?.length) return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      applyLayout(DEFAULT_LAYOUT, initialNodes, initialEdges);
      return;
    }

    const nodesChanged = !equal(
      initialNodes.map((n) => n.data),
      nodes.map((n) => n.data),
    );
    const edgesChanged = !equal(
      initialEdges.map((e) => ({ source: e.source, target: e.target })),
      edges.map((e) => ({ source: e.source, target: e.target })),
    );

    if (nodesChanged || edgesChanged) {
      applyLayout(selectedLayout, initialNodes, initialEdges);
    }
  }, [initialNodes, initialEdges, applyLayout, selectedLayout, nodes, edges]);

  useEffect(() => {
    if (shouldFitView) {
      fitView();
      setShouldFitView(false);
    }
  }, [shouldFitView, fitView]);

  useEffect(() => {
    const deleteDiv = document.getElementsByClassName(
      'react-flow__panel react-flow__attribution bottom right',
    );

    if (deleteDiv.length > 0) {
      deleteDiv[0].remove();
    }
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
