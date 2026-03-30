import { useState } from 'react';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { StatusDot } from './StatusDot';
import { useTreeContext } from './TreeContext';

interface StandaloneSectionProps {
  title: string;
  entityType: string;
  entities: Array<{ id: string; status: string; displayText: string }>;
  showStatusDot: boolean;
  variant?: 'default' | 'pending-checkpoint';
}

function StandaloneSection({
  title,
  entityType,
  entities,
  showStatusDot,
  variant = 'default',
}: StandaloneSectionProps) {
  const forceOpen = variant === 'pending-checkpoint';
  const [isOpen, setIsOpen] = useState(false);
  const { selectedEntity, select } = useTreeContext();

  function toggleOpen() {
    if (!forceOpen) {
      setIsOpen((prev) => !prev);
    }
  }

  const open = forceOpen ? true : isOpen;

  return (
    <div
      className={cn(
        'mt-4',
        variant === 'pending-checkpoint' &&
          'bg-orange-50 dark:bg-orange-950 border-l-4 border-orange-400 rounded-r-md',
      )}
    >
      {/* Header row */}
      <button
        className={cn(
          'flex items-center gap-2 w-full px-2 py-1.5 text-sm font-medium text-muted-foreground',
          variant === 'pending-checkpoint' && 'text-orange-700 dark:text-orange-300',
        )}
        onClick={toggleOpen}
        disabled={forceOpen}
      >
        {!forceOpen && (
          <ChevronRight
            className={cn(
              'w-4 h-4 transition-transform duration-200',
              open && 'rotate-90',
            )}
          />
        )}
        <span>{title}</span>
        {entities.length > 0 && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {entities.length}
          </Badge>
        )}
      </button>

      {/* Entity rows */}
      {open && (
        <div className="pb-1">
          {entities.length === 0 ? (
            <div className="px-6 py-1 text-sm text-muted-foreground italic">
              (none)
            </div>
          ) : (
            entities.map((entity) => (
              <button
                key={entity.id}
                data-entity-id={entity.id}
                className={cn(
                  'flex items-center gap-1.5 w-full text-left py-1 px-6 rounded-md text-sm',
                  'hover:bg-accent/50 cursor-pointer',
                  selectedEntity === entity.id && 'bg-accent',
                  variant === 'pending-checkpoint' &&
                    'bg-orange-50/50 dark:bg-orange-950/50',
                )}
                onClick={() => select(entity.id, entityType)}
              >
                {variant === 'pending-checkpoint' ? (
                  <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
                ) : showStatusDot ? (
                  <StatusDot status={entity.status} />
                ) : null}

                <span className="font-semibold font-mono shrink-0">
                  {entity.id}
                </span>
                <span className="text-muted-foreground truncate">
                  {entity.displayText}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export { StandaloneSection };
export type { StandaloneSectionProps };
