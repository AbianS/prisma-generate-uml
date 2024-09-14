import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  MiniMap,
  Node,
} from "reactflow"
import { useTheme } from "../lib/contexts/theme"
import { Model, ModelConnection } from "../lib/types/schema"
import { ModelNode } from "./ModelNode"

interface Props {
  models: Model[]
  connections: ModelConnection[]
}

export const SchemaVisualizer = ({ connections, models }: Props) => {
  const { isDarkMode } = useTheme()

  const modelTypes = {
    model: ModelNode,
  }

  let row = 0
  let column = 0
  const numModels = models.length
  let numGrid = 1

  // eslint-disable-next-line no-constant-condition
  while (1) {
    if (numGrid ** 2 >= numModels) {
      break
    }
    numGrid++
  }

  const nodes: Node[] = models.map((model, index) => {
    const x = row * 300
    const y = column * 300

    if (numGrid % index === 0) {
      column = 0
      row += 1
    } else {
      column += 1
    }

    return {
      id: model.name,
      data: model,
      position: { x: x, y: y },
      type: "model",
    }
  })
  const edges: Edge[] = connections.map((connection) => {
    return {
      id: `${connection.source}-${connection.target}`,
      source: connection.source.split("-")[0],
      target: connection.target.split("-")[0],
      sourceHandle: connection.source,
      targetHandle: connection.target,
      animated: true,
    }
  })

  // Definir colores según el tema
  const nodeColor = isDarkMode ? "#3d5797" : "#8b9dc3" // Color de los nodos
  const nodeStrokeColor = isDarkMode ? "#282828" : "#e0e0e0" // Color del borde de los nodos
  const maskColor = isDarkMode
    ? "rgba(0, 0, 0, 0.2)"
    : "rgba(255, 255, 255, 0.5)" // Color de la máscara

  return (
    <div
      className={`h-[100vh] w-full ${
        isDarkMode ? "bg-[#1c1c1c]" : "bg-[#e0e0e0]"
      }`}
    >
      <ReactFlow
        defaultNodes={nodes}
        defaultEdges={edges}
        minZoom={0.1}
        fitView
        nodeTypes={modelTypes}
        fitViewOptions={{
          padding: 0.4,
        }}
      >
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          nodeColor={nodeColor}
          nodeStrokeColor={nodeStrokeColor}
          maskColor={maskColor}
          className={isDarkMode ? "bg-[#1c1c1c]" : "bg-[#e0e0e0]"}
        />

        <Background
          color={isDarkMode ? "#222" : "#ccc"}
          variant={BackgroundVariant.Lines}
        />
      </ReactFlow>
    </div>
  )
}
