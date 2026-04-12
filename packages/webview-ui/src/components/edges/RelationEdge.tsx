import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  EdgeProps,
  getSmoothStepPath,
} from '@xyflow/react';
import { memo } from 'react';
import { type RelationType } from '../../lib/types/schema';

const RELATION_COLORS: Record<RelationType, string> = {
  ONE_TO_ONE: '#06d6a0', // teal
  ONE_TO_MANY: '#818cf8', // indigo
  MANY_TO_MANY: '#fbbf24', // amber
};

const DEFAULT_COLOR = '#94a3b8'; // slate

type RelationEdgeData = Edge<{
  relationType?: RelationType;
  label?: string;
  bidirectional?: boolean;
}>;

export const RelationEdge = memo(function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style = {},
  selected,
}: EdgeProps<RelationEdgeData>) {
  const relationType = data?.relationType as RelationType | undefined;
  const bidirectional = data?.bidirectional ?? false;
  const color = relationType ? RELATION_COLORS[relationType] : DEFAULT_COLOR;
  const strokeWidth = selected ? 3 : 2;
  const opacity = (style as React.CSSProperties).opacity ?? 1;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const markerId = `arrow-${relationType ?? 'default'}-${id}`;

  return (
    <>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>

      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={`url(#${markerId})`}
        markerStart={bidirectional ? `url(#${markerId})` : undefined}
        style={{
          stroke: color,
          strokeWidth,
          opacity: opacity as number,
          transition: 'opacity 0.2s ease, stroke-width 0.15s ease',
        }}
      />

      {relationType && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <span
              className="edge-label__text"
              style={{
                background: color,
                color: '#fff',
                fontSize: 9,
                fontWeight: 600,
                padding: '1px 5px',
                borderRadius: 4,
                letterSpacing: '0.02em',
                opacity: 0,
                transition: 'opacity 0.15s ease',
                whiteSpace: 'nowrap',
                display: 'inline-block',
              }}
            >
              {relationType.replace('_', ':').replace('_', ':')}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
