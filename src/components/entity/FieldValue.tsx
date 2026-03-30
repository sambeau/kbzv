import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EntityLink } from '@/components/common/EntityLink';
import { cn } from '@/lib/utils';

// ── Types ───────────────────────────────────────────────────────────

type FieldValueType = string | number | string[] | null | undefined;

interface FieldValueProps {
  label: string;
  value: FieldValueType;
  type:
    | 'text'
    | 'timestamp'
    | 'entity-ref'
    | 'entity-ref-list'
    | 'tag-list'
    | 'string-list'
    | 'long-text'
    | 'number'
    | 'severity'
    | 'priority'
    | 'status';
  className?: string;
  alwaysExpanded?: boolean;
}

// ── Severity / Priority badge colours ──────────────────────────────

const SEVERITY_PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

// ── Long text collapsible ───────────────────────────────────────────

function LongTextValue({ value, alwaysExpanded }: { value: string; alwaysExpanded?: boolean }) {
  const lines = value.split('\n');
  const needsCollapse = !alwaysExpanded && lines.length > 3;
  const [isOpen, setIsOpen] = useState(false);

  if (!needsCollapse) {
    return <pre className="text-sm whitespace-pre-wrap font-mono">{value}</pre>;
  }

  const preview = lines.slice(0, 3).join('\n');

  return (
    <div>
      <pre className="text-sm whitespace-pre-wrap font-mono">
        {isOpen ? value : preview + '…'}
      </pre>
      <button
        className="text-xs text-primary hover:underline mt-1"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? 'Show less' : 'Show more'}
      </button>
    </div>
  );
}

// ── Timestamp value ─────────────────────────────────────────────────

function TimestampValue({ value }: { value: string }) {
  let relative = value;
  try {
    relative = formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    relative = value;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-sm text-muted-foreground cursor-default">{relative}</span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{value}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ── Main component ──────────────────────────────────────────────────

function FieldValue({ label, value, type, className, alwaysExpanded }: FieldValueProps) {
  // Absent-field rule: render nothing for empty values
  if (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return null;
  }

  let content: React.ReactNode;

  switch (type) {
    case 'text':
      content = <span className={cn('text-sm', className)}>{value as string}</span>;
      break;

    case 'timestamp':
      content = <TimestampValue value={value as string} />;
      break;

    case 'entity-ref':
      content = <EntityLink entityId={value as string} />;
      break;

    case 'entity-ref-list':
      content = (
        <div className="flex flex-wrap gap-1.5">
          {(value as string[]).map((id) => (
            <EntityLink key={id} entityId={id} />
          ))}
        </div>
      );
      break;

    case 'tag-list':
      content = (
        <div className="flex flex-wrap gap-1">
          {(value as string[]).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      );
      break;

    case 'string-list':
      content = (
        <div className="flex flex-wrap gap-1">
          {(value as string[]).map((item) => (
            <Badge key={item} variant="outline" className="text-xs font-mono">
              {item}
            </Badge>
          ))}
        </div>
      );
      break;

    case 'long-text':
      content = <LongTextValue value={value as string} alwaysExpanded={alwaysExpanded} />;
      break;

    case 'number':
      content = <span className="text-sm font-mono">{value as number}</span>;
      break;

    case 'severity':
    case 'priority': {
      const v = (value as string).toLowerCase();
      content = (
        <Badge className={cn(SEVERITY_PRIORITY_STYLES[v] ?? SEVERITY_PRIORITY_STYLES.low)}>
          {value as string}
        </Badge>
      );
      break;
    }

    case 'status':
      content = <StatusBadge status={value as string} />;
      break;

    default:
      content = <span className="text-sm">{String(value)}</span>;
  }

  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </dt>
      <dd>{content}</dd>
    </div>
  );
}

export { FieldValue };
export type { FieldValueProps, FieldValueType };
