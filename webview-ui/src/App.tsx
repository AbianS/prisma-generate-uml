import { useEffect, useState } from "react"
import "./App.css"
import { SchemaVisualizer } from "./components/SchemaVisualizer"
import { Model, ModelConnection } from "./lib/types/schema"

function App() {
  const [models, setModels] = useState<Model[]>([])
  const [connections, setConnections] = useState<ModelConnection[]>([])

  useEffect(() => {
    window.addEventListener("message", (event) => {
      const message = event.data // El mensaje enviado desde VS Code

      if (message.command === "setData") {
        setModels(message.models)
        setConnections(message.connections)
      }
    })

    return () => window.removeEventListener("message", () => {})
  }, [])

  useEffect(() => {
    console.log(models)

    console.log(connections)
  }, [models, connections])

  return (
    models.length > 0 &&
    connections.length > 0 && (
      <SchemaVisualizer models={models} connections={connections} />
    )
  )
}

export default App
