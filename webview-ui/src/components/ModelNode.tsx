import { Handle, NodeProps, Position } from 'reactflow';
import { useTheme } from '../lib/contexts/theme';
import { Model } from '../lib/types/schema';

export const ModelNode = ({ data }: NodeProps<Model>) => {
  const { isDarkMode } = useTheme();

  return (
    <div className="rounded-lg min-w-[250px]">
      {data.isChild && (
        <Handle
          id={`${data.name}-target`}
          position={Position.Top}
          type="target"
        />
      )}
      <div
        className={`p-1 text-center rounded-t-lg rounded-b-none ${
          isDarkMode ? 'bg-[#3d5797]' : 'bg-[#5470c6]'
        }`}
      >
        <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
          <pre>{data.name}</pre>
        </p>
      </div>
      {data.fields.map(({ type, name, hasConnections }, index) => (
        <div
          key={name}
          className={`flex justify-between p-1 ${
            isDarkMode
              ? index % 2 === 0
                ? 'bg-[#282828] text-white'
                : 'bg-[#232323] text-white'
              : index % 2 === 0
                ? 'bg-[#d3d3d3] text-black'
                : 'bg-[#e0e0e0] text-black'
          }`}
        >
          <p>
            <pre>{name}</pre>
          </p>
          <p>
            <pre>{type}</pre>
          </p>
          {hasConnections && (
            <Handle
              position={Position.Right}
              id={`${data.name}-${name}-source`}
              type="source"
              style={{
                top: 27 + 16 + 27 * index,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
};
