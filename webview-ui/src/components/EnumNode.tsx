import { NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { useTheme } from '../lib/contexts/theme';
import { EnumNodeTye } from '../lib/types/schema';

export const EnumNode = memo(({ data }: NodeProps<EnumNodeTye>) => {
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
        min-w-[150px]
      `}
    >
      <div
        className={`
          p-2 text-center 
          ${
            isDarkMode
              ? 'bg-gradient-to-r from-green-600 to-teal-700'
              : 'bg-gradient-to-r from-green-400 to-teal-500'
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
        {data.values.map((value, index) => (
          <div
            key={value}
            className={`
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
            <pre className="whitespace-pre-wrap">{value}</pre>
          </div>
        ))}
      </div>
    </div>
  );
});
