import { useEffect, useState } from "react"
import { SchemaVisualizer } from "./components/SchemaVisualizer"
import { ThemeProvider } from "./lib/contexts/theme"
import {
  ColorThemeKind,
  Enum,
  Model,
  ModelConnection,
} from "./lib/types/schema"
import { ReactFlowProvider } from "reactflow"

function App() {
  const [models, setModels] = useState<Model[]>([])
  const [enums, setEnums] = useState<Enum[]>([])
  const [theme, setTheme] = useState<ColorThemeKind>(ColorThemeKind.Dark)
  const [connections, setConnections] = useState<ModelConnection[]>([])

  useEffect(() => {
    window.addEventListener("message", (event) => {
      const message = event.data

      if (message.command === "setData") {
        setModels(message.models)
        setConnections(message.connections)
        setEnums(message.enums)
      }

      if (message.command === "setTheme") {
        setTheme(message.theme)
      }
    })

    return () => window.removeEventListener("message", () => {})
  }, [])

  return (
    models.length > 0 &&
    connections.length > 0 && (
      <ThemeProvider theme={theme}>
        <ReactFlowProvider>
          <SchemaVisualizer
            models={models}
            connections={connections}
            enums={enums}
          />
        </ReactFlowProvider>
      </ThemeProvider>
    )
  )
}

export default App
