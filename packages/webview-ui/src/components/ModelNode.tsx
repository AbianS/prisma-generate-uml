import { Handle, NodeProps, Position } from '@xyflow/react';
import { JSX, memo } from 'react';
import { useTheme } from '../lib/contexts/theme';
import { useSettings } from '../lib/contexts/settings';
import { ModelNodeTye } from '../lib/types/schema';

import {
  Calculator,
  Calendar,
  CheckSquare,
  File,
  FileText,
  Hash,
  Key,
  Link2,
  List,
  Type,
} from 'lucide-react';

const typeIcons: Record<string, JSX.Element> = {
  string: <Type size={13} />,
  int: <Hash size={13} />,
  float: <Calculator size={13} />,
  double: <Hash size={13} />,
  decimal: <Hash size={13} />,
  bigint: <Hash size={13} />,
  date: <Calendar size={13} />,
  datetime: <Calendar size={13} />,
  boolean: <CheckSquare size={13} />,
  text: <FileText size={13} />,
  file: <File size={13} />,
  enum: <List size={13} />,
};

const getIconForType = (type: string) => {
  return typeIcons[type.toLowerCase()] || <Link2 size={13} />;
};

export const ModelNode = memo(({ data, selected }: NodeProps<ModelNodeTye>) => {
  const { isDarkMode } = useTheme();
  const { settings } = useSettings();

  const connectionCount = data.fields.filter((f) => f.hasConnections).length;

  return (
    <div
      className={[
        'rounded-xl border overflow-hidden shadow-md transition-all duration-200',
        'min-w-[200px] max-w-[320px]',
        isDarkMode
          ? 'border-gray-700 bg-[#1c1c1c]'
          : 'border-gray-200 bg-white',
        selected
          ? 'shadow-lg ring-2 ring-indigo-500 ring-offset-1'
          : 'hover:shadow-lg',
      ].join(' ')}
    >
      {/* Shared target handle on the left edge */}
      <Handle
        id={`${data.name}-target`}
        position={Position.Left}
        type="target"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      />

      {/* Header */}
      <div
        className="px-3 py-2 flex items-center justify-between gap-2"
        style={{
          background: `linear-gradient(135deg, ${settings.theme.primaryColor}, ${settings.theme.secondaryColor})`,
        }}
      >
        <p
          className="font-semibold text-sm tracking-wide truncate"
          style={{ color: settings.theme.titleColor }}
          title={data.name}
        >
          {data.name}
        </p>
        {connectionCount > 0 && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{
              background: 'rgba(255,255,255,0.25)',
              color: settings.theme.titleColor,
            }}
          >
            {connectionCount}
          </span>
        )}
      </div>

      {/* Fields */}
      <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {data.fields.map(({ type, name, hasConnections, isPrimary }, index) => (
          <div
            key={name}
            className={[
              'relative flex items-center gap-2 px-3 py-1.5 text-xs',
              isDarkMode
                ? index % 2 === 0
                  ? 'bg-[#252525]'
                  : 'bg-[#1e1e1e]'
                : index % 2 === 0
                  ? 'bg-gray-50'
                  : 'bg-white',
            ].join(' ')}
          >
            {/* Field icon */}
            {settings.showFieldIcons && (
              <span
                className={
                  isPrimary
                    ? 'text-amber-400 flex-shrink-0'
                    : isDarkMode
                      ? 'text-gray-500 flex-shrink-0'
                      : 'text-gray-400 flex-shrink-0'
                }
              >
                {isPrimary ? <Key size={13} /> : getIconForType(type)}
              </span>
            )}

            {/* Field name */}
            <span
              className={[
                'font-medium truncate',
                isPrimary
                  ? 'text-amber-400'
                  : isDarkMode
                    ? 'text-gray-200'
                    : 'text-gray-700',
              ].join(' ')}
              title={name}
            >
              {name}
            </span>

            {/* Field type */}
            {settings.showFieldTypes && (
              <span
                className={[
                  'ml-auto font-mono text-[10px] flex-shrink-0',
                  isDarkMode ? 'text-gray-500' : 'text-gray-400',
                ].join(' ')}
                title={type}
              >
                {type}
              </span>
            )}

            {/* Source handle — positioned relative to this row */}
            {hasConnections && (
              <Handle
                position={Position.Right}
                id={`${data.name}-${name}-source`}
                type="source"
                style={{
                  position: 'absolute',
                  right: -6,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 10,
                  height: 10,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
