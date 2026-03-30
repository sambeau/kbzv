import {
  Map,
  Puzzle,
  CheckSquare,
  Bug,
  Scale,
  AlertOctagon,
  CircleHelp,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUIStore } from '@/lib/store/ui-store';
import { STATUS_COLOURS } from '@/lib/constants/status-colours';
import type { StatusColourName } from '@/lib/constants/status-colours';
import { ENTITY_TYPES } from '@/lib/constants/entity-types';

// ── Workflow entity types shown in filter bar ───────────────────────

interface WorkflowEntityTypeInfo {
  type: string;
  label: string;
  icon: LucideIcon;
}

const WORKFLOW_ENTITY_TYPES: WorkflowEntityTypeInfo[] = [
  { type: 'plan',       label: ENTITY_TYPES.plan.label,       icon: Map },
  { type: 'feature',    label: ENTITY_TYPES.feature.label,    icon: Puzzle },
  { type: 'task',       label: ENTITY_TYPES.task.label,       icon: CheckSquare },
  { type: 'bug',        label: ENTITY_TYPES.bug.label,        icon: Bug },
  { type: 'decision',   label: ENTITY_TYPES.decision.label,   icon: Scale },
  { type: 'incident',   label: ENTITY_TYPES.incident.label,   icon: AlertOctagon },
  { type: 'checkpoint', label: ENTITY_TYPES.checkpoint.label, icon: CircleHelp },
];

const COLOUR_GROUPS: StatusColourName[] = [
  'grey', 'blue', 'yellow', 'orange', 'green', 'red', 'purple',
];

// ── Statuses belonging to each colour group (for tooltip text) ──────

const COLOUR_TO_STATUSES: Record<StatusColourName, string[]> = {
  grey:   ['proposed', 'queued', 'draft', 'reported'],
  blue:   ['designing', 'specifying', 'dev-planning', 'ready', 'planned', 'contributed', 'triaged', 'reproduced'],
  yellow: ['active', 'in-progress', 'investigating', 'developing', 'root-cause-identified'],
  orange: ['blocked', 'needs-review', 'needs-rework', 'disputed', 'pending', 'mitigated'],
  green:  ['done', 'closed', 'verified', 'approved', 'accepted', 'confirmed', 'resolved', 'responded'],
  red:    ['cancelled', 'not-planned', 'rejected', 'duplicate', 'retired', 'cannot-reproduce'],
  purple: ['superseded'],
};

// ── Type toggle ─────────────────────────────────────────────────────

interface TypeToggleProps {
  info: WorkflowEntityTypeInfo;
  isActive: boolean;
  onToggle: () => void;
}

function TypeToggle({ info, isActive, onToggle }: TypeToggleProps) {
  const IconComponent = info.icon;
  return (
    <Toggle
      pressed={isActive}
      onPressedChange={onToggle}
      size="sm"
      className={cn(!isActive && 'opacity-50')}
      aria-label={`Toggle ${info.label} visibility`}
    >
      <IconComponent className="w-4 h-4 mr-1" />
      <span className="text-xs">{info.label}</span>
    </Toggle>
  );
}

// ── Status colour toggle ────────────────────────────────────────────

interface StatusColourToggleProps {
  colour: StatusColourName;
  isActive: boolean;
  onToggle: () => void;
}

function StatusColourToggle({ colour, isActive, onToggle }: StatusColourToggleProps) {
  const hex = STATUS_COLOURS[colour];
  const tooltipStatuses = COLOUR_TO_STATUSES[colour].join(', ');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          pressed={isActive}
          onPressedChange={onToggle}
          size="sm"
          className={cn('px-2', !isActive && 'opacity-50')}
          aria-label={`Toggle ${colour} status group`}
        >
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: hex }}
          />
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs max-w-[200px]">{tooltipStatuses}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ── FilterBar ───────────────────────────────────────────────────────

function FilterBar() {
  const activeTypes = useUIStore((s) => s.activeTypes);
  const activeStatusColours = useUIStore((s) => s.activeStatusColours);
  const toggleType = useUIStore((s) => s.toggleType);
  const toggleStatusColour = useUIStore((s) => s.toggleStatusColour);

  const inactiveTypes = WORKFLOW_ENTITY_TYPES
    .map((t) => t.type)
    .filter((type) => !activeTypes.has(type));

  const inactiveColours = COLOUR_GROUPS.filter(
    (colour) => !activeStatusColours.has(colour),
  );

  const hasActiveFilters = inactiveTypes.length > 0 || inactiveColours.length > 0;

  return (
    <div className="border-b px-4 py-2 space-y-2">
      {/* Row 1: Type toggles */}
      <div className="flex items-center gap-1 flex-wrap">
        {WORKFLOW_ENTITY_TYPES.map((info) => (
          <TypeToggle
            key={info.type}
            info={info}
            isActive={activeTypes.has(info.type)}
            onToggle={() => toggleType(info.type)}
          />
        ))}
      </div>

      {/* Row 2: Status colour toggles */}
      <div className="flex items-center gap-1">
        {COLOUR_GROUPS.map((colour) => (
          <StatusColourToggle
            key={colour}
            colour={colour}
            isActive={activeStatusColours.has(colour)}
            onToggle={() => toggleStatusColour(colour)}
          />
        ))}
      </div>

      {/* Row 3: Active filter badges (only when filters are active) */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1 flex-wrap">
          {inactiveTypes.map((type) => {
            const info = WORKFLOW_ENTITY_TYPES.find((t) => t.type === type);
            return (
              <Badge
                key={type}
                variant="secondary"
                className="text-xs cursor-pointer gap-1"
                onClick={() => toggleType(type)}
              >
                <X className="w-3 h-3" />
                {info?.label ?? type}
              </Badge>
            );
          })}
          {inactiveColours.map((colour) => (
            <Badge
              key={colour}
              variant="secondary"
              className="text-xs cursor-pointer gap-1"
              onClick={() => toggleStatusColour(colour)}
            >
              <X className="w-3 h-3" />
              {colour}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export { FilterBar };
