import { useCallback, useEffect, useLayoutEffect, useState } from "react"
import {
  addEdge,
  Connection,
  ConnectionLineType,
  Edge,
  Node,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "reactflow"
import { getLayoutedElements } from "../utils/layout-utils"

export const useGraph = (initialNodes: Node[], initialEdges: Edge[]) => {
  const { fitView } = useReactFlow()

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [shouldFitView, setShouldFitView] = useState(false)
  const [selectedLayout, setSelectedLayout] = useState("TB")

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          { ...params, type: ConnectionLineType.SmoothStep, animated: true },
          eds,
        ),
      ),
    [],
  )

  const onLayout = useCallback(
    (direction: string) => {
      const { nodes: newLayoutedNodes, edges: newLayoutedEdges } =
        getLayoutedElements(nodes, edges, direction)
      setNodes(newLayoutedNodes)
      setEdges(newLayoutedEdges)

      setShouldFitView(true)
      setSelectedLayout(direction)
    },
    [nodes, edges, fitView],
  )

  useLayoutEffect(() => {
    const { nodes: newLayoutedNodes, edges: newLayoutedEdges } =
      getLayoutedElements(nodes, edges)

    setNodes(newLayoutedNodes)
    setEdges(newLayoutedEdges)

    fitView()
  }, [fitView])

  useEffect(() => {
    if (shouldFitView) {
      fitView()

      setShouldFitView(false)
    }
  }, [shouldFitView, fitView])

  useEffect(() => {
    const deleteDiv = document.getElementsByClassName(
      "react-flow__panel react-flow__attribution bottom right",
    )

    if (deleteDiv.length > 0) {
      deleteDiv[0].remove()
    }
  }, [])

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
  }
}
