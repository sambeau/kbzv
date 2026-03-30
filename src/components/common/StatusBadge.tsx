import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { getStatusColour } from '@/lib/constants/status-colours';
import { useUIStore } from '@/lib/store/ui-store';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  grey:   'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  blue:   'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  green:  'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  red:    'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

function StatusBadge({ status, className }: StatusBadgeProps) {
  const activateStatusFilter = useUIStore((s) => s.activateStatusFilter);
  const colour = getStatusColour(status);

  return (
    <Badge
      className={cn(
        STATUS_BADGE_STYLES[colour] ?? STATUS_BADGE_STYLES.grey,
        'cursor-pointer',
        className,
      )}
      onClick={() => activateStatusFilter(status)}
    >
      {status}
    </Badge>
  );
}

export { StatusBadge };
export type { StatusBadgeProps };
