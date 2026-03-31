// src/components/metrics/ProgressBar.tsx

import { Progress } from "@radix-ui/themes";

interface ProgressBarProps {
  done: number;
  total: number;
  percentage: number;
  label?: string;
}

function ProgressBar({ done, total, percentage, label }: ProgressBarProps) {
  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No {label?.toLowerCase() ?? "items"}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">
        {label && <span>{label} </span>}
        {done}/{total} done ({Math.round(percentage)}%)
      </p>
      <Progress
        value={percentage}
        color={percentage === 100 ? "green" : "blue"}
        size="1"
      />
    </div>
  );
}

export { ProgressBar };
export type { ProgressBarProps };
