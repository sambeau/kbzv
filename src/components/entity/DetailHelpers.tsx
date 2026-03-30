import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EntityLink } from '@/components/common/EntityLink';
import { StatusDot } from '@/components/tree/StatusDot';

// ── DetailHeader ────────────────────────────────────────────────────

interface DetailHeaderProps {
  icon: LucideIcon;
  entityId: string;
  summary: string;
  status: string;
  className?: string;
}

function DetailHeader({ icon: Icon, entityId, summary, status, className }: DetailHeaderProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
        <h2 className="text-lg font-bold font-mono">{entityId}</h2>
      </div>
      <p className="text-base text-muted-foreground">{summary}</p>
      <StatusBadge status={status} />
    </div>
  );
}

// ── RelatedEntitiesSection ──────────────────────────────────────────

function RelatedEntitiesSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Separator />
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── RelatedEntityRow ────────────────────────────────────────────────

function RelatedEntityRow({
  entityId,
  summary,
  status,
}: {
  entityId: string;
  summary: string;
  status: string;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <EntityLink entityId={entityId} />
      <span className="text-sm text-muted-foreground truncate">{summary}</span>
      <StatusDot status={status} className="ml-auto shrink-0" />
    </div>
  );
}

export { DetailHeader, RelatedEntitiesSection, RelatedEntityRow };
export type { DetailHeaderProps };
