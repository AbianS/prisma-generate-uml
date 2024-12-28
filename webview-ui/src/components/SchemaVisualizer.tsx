import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ControlButton,
  Controls,
  Edge,
  MiniMap,
  Panel,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import { useTheme } from '../lib/contexts/theme';
import { useGraph } from '../lib/hooks/useGraph';
import { Enum, Model, ModelConnection } from '../lib/types/schema';
import {
  getButtonStyle,
  maskColor,
  nodeColor,
  nodeStrokeColor,
} from '../lib/utils/colots';
import { screenshot } from '../lib/utils/screnshot';
import { EnumNode } from './EnumNode';
import { ModelNode } from './ModelNode';
import { IDownload } from './icons/IDownload';

interface Props {
  models: Model[];
  connections: ModelConnection[];
  enums: Enum[];
}

export const SchemaVisualizer = ({ connections, models, enums }: Props) => {
  const { isDarkMode } = useTheme();
  const { getNodes } = useReactFlow();

  const modelNodes = models.map((model) => ({
    id: model.name,
    data: model,
    type: 'model',
    position: { x: 0, y: 0 },
  }));

  const enumNodes = enums.map((enumItem) => ({
    id: enumItem.name,
    data: enumItem,
    type: 'enum',
    position: { x: 0, y: 0 },
  }));

  const edges: Edge[] = connections.map((connection) => ({
    id: `${connection.source}-${connection.target}`,
    source: connection.source.split('-')[0],
    target: connection.target.split('-')[0],
    sourceHandle: connection.source,
    targetHandle: connection.target,
    animated: true,

    style: {
      stroke: isDarkMode ? '#ffffff' : '#000000',
      strokeWidth: 2,
      strokeOpacity: 0.5,
      strokeLinejoin: 'round',
      strokeLinecap: 'round',
      strokeDasharray: '5',
      strokeDashoffset: 0,
      fill: 'none',
    },
  }));

  const {
    nodes,
    edges: edgesState,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onLayout,
    selectedLayout,
  } = useGraph([...modelNodes, ...enumNodes], edges);

  return (
    <div
      className={`h-[100vh] w-full relative ${
        isDarkMode ? 'bg-[#1c1c1c]' : 'bg-[#e0e0e0]'
      }`}
    >
      <ReactFlow
        colorMode={isDarkMode ? 'dark' : 'light'}
        nodes={nodes}
        edges={edgesState}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={{ model: ModelNode, enum: EnumNode }}
        connectionLineType={ConnectionLineType.SmoothStep}
        minZoom={0.2}
        fitView
      >
        <Controls>
          <ControlButton
            title="Download"
            onClick={() => screenshot(getNodes as any)}
          >
            <IDownload color={isDarkMode ? 'white' : 'black'} />
          </ControlButton>
        </Controls>
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          nodeColor={nodeColor(isDarkMode)}
          nodeStrokeColor={nodeStrokeColor(isDarkMode)}
          maskColor={maskColor(isDarkMode)}
          className={isDarkMode ? 'bg-[#1c1c1c]' : 'bg-[#e0e0e0]'}
        />
        <Background
          color={isDarkMode ? '#222' : '#ccc'}
          variant={BackgroundVariant.Lines}
        />
        <Panel position="top-right" className="flex flex-row gap-5">
          <button
            onClick={() => onLayout('TB')}
            className={getButtonStyle(selectedLayout, 'TB')}
          >
            Vertical Layout
          </button>
          <button
            onClick={() => onLayout('LR')}
            className={getButtonStyle(selectedLayout, 'LR')}
          >
            Horizontal Layout
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
};
