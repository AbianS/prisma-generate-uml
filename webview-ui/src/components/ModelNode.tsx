import { Handle, NodeProps, Position } from '@xyflow/react';
import { JSX, memo } from 'react';
import { useTheme } from '../lib/contexts/theme';
import { ModelNodeTye } from '../lib/types/schema';

import {
  Calculator,
  Calendar,
  CheckSquare,
  File,
  FileText,
  Hash,
  Link2,
  List,
  Type,
} from 'lucide-react';

const typeIcons: Record<string, JSX.Element> = {
  string: <Type size={16} />,
  int: <Hash size={16} />,
  float: <Calculator size={16} />,
  double: <Hash size={16} />,
  date: <Calendar size={16} />,
  datetime: <Calendar size={16} />,
  boolean: <CheckSquare size={16} />,
  text: <FileText size={16} />,
  file: <File size={16} />,
  enum: <List size={16} />,
};

const getIconForType = (type: string) => {
  return typeIcons[type.toLowerCase()] || <Link2 size={16} />;
};

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
            <div className="flex items-center gap-2">
              {getIconForType(type)}
              <span className="font-medium whitespace-pre-wrap">{name}</span>
            </div>
            <div className="ml-auto text-gray-600 dark:text-gray-300">
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
