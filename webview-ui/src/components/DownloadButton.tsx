import { useCallback, useState } from "react"
import {
  Panel,
  useReactFlow,
  getRectOfNodes,
  getTransformForBounds,
} from "reactflow"
import { toPng } from "html-to-image"

interface VSCodeAPI {
  postMessage(message: SaveImageMessage): void
  getState(): unknown
  setState(state: unknown): void
}

interface SaveImageMessage {
  command: "saveImage"
  data: {
    format: "png"
    dataUrl: string
  }
}

declare function acquireVsCodeApi(): VSCodeAPI

const vscode = acquireVsCodeApi()

const SCALE_FACTOR = 4
const PADDING = 50

function DownloadButton() {
  const [isLoading, setIsLoading] = useState(false)
  const { getNodes, getEdges, getViewport, setViewport } = useReactFlow()

  const onClick = useCallback(async () => {
    setIsLoading(true)
    const nodes = getNodes()

    const nodesBounds = getRectOfNodes(nodes)
    const width = nodesBounds.width + PADDING * 2
    const height = nodesBounds.height + PADDING * 2

    const transform = getTransformForBounds(
      {
        x: nodesBounds.x - PADDING,
        y: nodesBounds.y - PADDING,
        width,
        height,
      },
      width,
      height,
      0.5,
      Infinity,
    )

    const scaledWidth = width * SCALE_FACTOR
    const scaledHeight = height * SCALE_FACTOR

    const flowElement = document.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement

    if (flowElement) {
      // Store current styles
      const originalTransform = flowElement.style.transform
      const originalWidth = flowElement.style.width
      const originalHeight = flowElement.style.height

      // Apply new styles without affecting the visible area
      flowElement.style.transform = `translate(${transform[0]}px, ${transform[1]}px) scale(${transform[2]})`
      flowElement.style.width = `${width}px`
      flowElement.style.height = `${height}px`

      try {
        const dataUrl = await toPng(flowElement, {
          backgroundColor: "transparent",
          width: scaledWidth,
          height: scaledHeight,
          style: {
            transform: `scale(${SCALE_FACTOR})`,
            transformOrigin: "top left",
          },
          filter: (node) => {
            const exclude = [
              "react-flow__minimap",
              "react-flow__controls",
              "download-btn",
            ]
            return !exclude.some((className) =>
              node.classList?.contains(className),
            )
          },
        })

        vscode.postMessage({
          command: "saveImage",
          data: { format: "png", dataUrl },
        })
      } catch (error) {
        console.error("Error generating image:", error)
      } finally {
        // Restore original styles
        flowElement.style.transform = originalTransform
        flowElement.style.width = originalWidth
        flowElement.style.height = originalHeight
        setIsLoading(false)
      }
    }
  }, [getNodes, getEdges, getViewport, setViewport])

  return (
    <Panel position="top-left">
      <button
        className={`download-btn ${isLoading ? "loading" : ""}`}
        onClick={onClick}
        disabled={isLoading}
      >
        Download
        {isLoading && <span className="spinner"></span>}
      </button>
    </Panel>
  )
}

export default DownloadButton
