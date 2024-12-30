import { NodeProps } from '@xyflow/react';
import { useTheme } from '../lib/contexts/theme';
import { EnumNodeTye } from '../lib/types/schema';
import { memo } from 'react';

export const EnumNode = memo(({ data }: NodeProps<EnumNodeTye>) => {
  const { isDarkMode } = useTheme();

  return (
    <div className="rounded-lg min-w-[150px]">
      <div
        className={`p-1 text-center rounded-t-lg rounded-b-none ${
          isDarkMode ? 'bg-[#5a9f78]' : 'bg-[#6ec19d]'
        } `}
      >
        <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
          <pre>{data.name}</pre>
        </p>
      </div>
      {data.values.map((value, index) => (
        <div
          key={value}
          className={`flex justify-between p-1  ${
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
            <pre>{value}</pre>
          </p>
        </div>
      ))}
    </div>
  );
});
