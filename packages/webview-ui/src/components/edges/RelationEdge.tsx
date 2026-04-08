import {
  BaseEdge,
  Edge,
  EdgeLabelRenderer,
  EdgeProps,
  getSmoothStepPath,
} from '@xyflow/react';
import { type RelationType } from '../../lib/types/schema';

const RELATION_COLORS: Record<RelationType, string> = {
  ONE_TO_ONE: '#10b981', // emerald
  ONE_TO_MANY: '#6366f1', // indigo
  MANY_TO_MANY: '#f59e0b', // amber
};

const DEFAULT_COLOR = '#64748b'; // slate

type RelationEdgeData = Edge<{
  relationType?: RelationType;
  label?: string;
}>;

export function RelationEdge({
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

  const markerId = `arrow-${relationType ?? 'default'}`;

  return (
    <>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>

      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={`url(#${markerId})`}
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
}
