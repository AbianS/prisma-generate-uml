import { Handle, NodeProps, Position } from '@xyflow/react';
import { memo } from 'react';
import { useTheme } from '../lib/contexts/theme';
import { ModelNodeTye } from '../lib/types/schema';

export const ModelNode = memo(({ data }: NodeProps<ModelNodeTye>) => {
  const { isDarkMode } = useTheme();

  return (
    <div
      className={`
        rounded-xl 
        border 
        ${isDarkMode ? 'border-gray-700 bg-[#1c1c1c]' : 'border-gray-300 bg-white'}
        shadow-md 
        overflow-hidden 
        transition-shadow 
        duration-300 
        hover:shadow-lg
        min-w-[250px]
      `}
    >
      {data.isChild && (
        <Handle
          id={`${data.name}-target`}
          position={Position.Top}
          type="target"
        />
      )}

      <div
        className={`
          p-2 text-center 
          ${
            isDarkMode
              ? 'bg-gradient-to-r from-blue-600 to-indigo-700'
              : 'bg-gradient-to-r from-blue-400 to-indigo-500'
          }
        `}
      >
        <p
          className={`
            font-semibold 
            tracking-wide 
            ${isDarkMode ? 'text-white' : 'text-white'}
          `}
        >
          <pre>{data.name}</pre>
        </p>
      </div>

      <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700">
        {data.fields.map(({ type, name, hasConnections }, index) => (
          <div
            key={name}
            className={`
              flex 
              justify-between 
              items-center 
              px-3 py-2 
              text-sm
              ${
                isDarkMode
                  ? index % 2 === 0
                    ? 'bg-[#2a2a2a]'
                    : 'bg-[#232323]'
                  : index % 2 === 0
                    ? 'bg-gray-50'
                    : 'bg-white'
              }
              transition-colors 
              duration-200
            `}
          >
            <div className="font-medium">
              <pre className="whitespace-pre-wrap">{name}</pre>
            </div>
            <div className="text-gray-600 dark:text-gray-300">
              <pre className="whitespace-pre-wrap">{type}</pre>
            </div>

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
    </div>
  );
});
