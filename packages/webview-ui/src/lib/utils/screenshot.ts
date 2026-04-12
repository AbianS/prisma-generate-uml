import { Node, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { toPng } from 'html-to-image';
import { getVsCodeApi } from './vscode-api';

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
    0,
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
      const vscode = getVsCodeApi();
      if (vscode) {
        vscode.postMessage({
          command: 'saveImage',
          data: { format: 'png', dataUrl },
        });
      } else {
        console.error('VS Code API not available for screenshot');
      }
    })
    .catch((error) => {
      console.error('Error generating image:', error);
    });
};
