import { StrictMode } from "react"
import "reactflow/dist/style.css"
import App from "./App"
import { createRoot } from "react-dom/client"
import "./globals.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
