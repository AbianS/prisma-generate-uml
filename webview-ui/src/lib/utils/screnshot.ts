import { toPng } from 'html-to-image';
import { Node, getNodesBounds, getViewportForBounds } from 'reactflow';

interface VSCodeAPI {
  postMessage(message: SaveImageMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

interface SaveImageMessage {
  command: 'saveImage';
  data: {
    format: 'png';
    dataUrl: string;
  };
}

declare function acquireVsCodeApi(): VSCodeAPI;

const vscode = acquireVsCodeApi();

export const screenshot = (getNodes: () => Node[]) => {
  const nodesBounds = getNodesBounds(getNodes());

  // 8k resolution
  const imageWidth = 7680;
  const imageHeight = 4320;

  const transform = getViewportForBounds(
    nodesBounds,
    imageWidth,
    imageHeight,
    0,
    2,
  );

  toPng(document.querySelector('.react-flow__viewport') as HTMLElement, {
    filter: (node) => {
      const exclude = ['react-flow__minimap', 'react-flow__controls'];
      return !exclude.some((className) => node.classList?.contains(className));
    },
    backgroundColor: 'transparent',
    width: imageWidth,
    height: imageHeight,
    style: {
      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
    },
  })
    .then((dataUrl) => {
      vscode.postMessage({
        command: 'saveImage',
        data: { format: 'png', dataUrl },
      });
    })
    .catch((error) => {
      console.error('Error generating image:', error);
    });
};
