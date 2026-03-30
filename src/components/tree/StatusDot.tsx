import { cn } from '@/lib/utils';
import { getStatusHex } from '@/lib/constants/status-colours';

interface StatusDotProps {
  status: string;
  className?: string;
}

export function StatusDot({ status, className }: StatusDotProps) {
  const hex = getStatusHex(status);
  return (
    <span
      className={cn('inline-block w-2 h-2 rounded-full shrink-0', className)}
      style={{ backgroundColor: hex }}
      title={status}
    />
  );
}
