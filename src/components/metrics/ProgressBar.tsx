import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

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
        No {label?.toLowerCase() ?? 'items'}
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
        className={cn(
          'h-2',
          percentage === 100 && '[&>div]:bg-green-500',
        )}
      />
    </div>
  );
}

export { ProgressBar };
export type { ProgressBarProps };
