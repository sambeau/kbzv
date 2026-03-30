import type { EstimateRollup } from '@/lib/query/metrics';

interface EstimateDisplayProps {
  rollup: EstimateRollup;
  entityEstimate?: number;
}

function EstimateDisplay({ rollup, entityEstimate }: EstimateDisplayProps) {
  const allUnestimated = rollup.estimatedCount === 0 && rollup.unestimatedCount > 0;

  return (
    <div className="space-y-1">
      {entityEstimate != null ? (
        <p className="text-sm font-mono">{entityEstimate} pts</p>
      ) : allUnestimated ? (
        <p className="text-sm text-muted-foreground italic">unestimated</p>
      ) : null}

      {rollup.estimatedCount > 0 && (
        <p className="text-xs text-muted-foreground">
          Rollup: {rollup.totalPoints} pts
          ({rollup.estimatedCount} estimated, {rollup.unestimatedCount} unestimated)
        </p>
      )}
    </div>
  );
}

export { EstimateDisplay };
export type { EstimateDisplayProps };
