import { Handle, NodeProps, Position } from '@xyflow/react';
import { memo } from 'react';
import { useSettings } from '../lib/contexts/settings';
import { useTheme } from '../lib/contexts/theme';
import { EnumNodeTye } from '../lib/types/schema';

export const EnumNode = memo(
  ({ data, selected, targetPosition }: NodeProps<EnumNodeTye>) => {
    const { isDarkMode } = useTheme();
    const { settings } = useSettings();

    return (
      <div
        className={[
          'rounded-xl border overflow-hidden shadow-md transition-all duration-200',
          'min-w-[140px] max-w-[260px]',
          isDarkMode
            ? 'border-gray-700 bg-[#1c1c1c]'
            : 'border-gray-200 bg-white',
          selected
            ? 'shadow-lg ring-2 ring-emerald-500 ring-offset-1'
            : 'hover:shadow-lg',
        ].join(' ')}
      >
        {/* Target handle — position driven by layout direction */}
        <Handle
          id={`${data.name}-target`}
          position={targetPosition ?? Position.Left}
          type="target"
          style={{
            top: '50%',
            transform: 'translateY(-50%)',
            borderColor: '#06d6a0',
          }}
        />

        <div
          className="px-3 py-2 text-center"
          style={{
            background: `linear-gradient(135deg, ${settings.theme.enumColor}, ${settings.theme.enumColor}cc)`,
          }}
        >
          <p
            className="font-semibold text-sm tracking-wide truncate"
            style={{ color: settings.theme.titleColor }}
            title={data.name}
          >
            {data.name}
          </p>
        </div>

        <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {data.values.map((value, index) => (
            <div
              key={value}
              className={[
                'px-3 py-1.5 text-xs font-mono',
                isDarkMode
                  ? index % 2 === 0
                    ? 'bg-[#252525] text-gray-300'
                    : 'bg-[#1e1e1e] text-gray-300'
                  : index % 2 === 0
                    ? 'bg-gray-50 text-gray-700'
                    : 'bg-white text-gray-700',
              ].join(' ')}
            >
              {value}
            </div>
          ))}
        </div>
      </div>
    );
  },
);
