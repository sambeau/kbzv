// src/components/document/DocumentFilterBar.tsx

import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { SortOption } from "@/lib/store/ui-store";

// ── Constants ───────────────────────────────────────────────────────

const KNOWN_DOC_TYPES = [
  "design",
  "specification",
  "dev-plan",
  "research",
  "report",
  "policy",
] as const;

const STATUS_TOGGLES = [
  { value: "approved", label: "Approved", colour: "#22C55E" },
  { value: "draft",    label: "Draft",    colour: "#9CA3AF" },
  { value: "superseded", label: "Superseded", colour: "#A855F7" },
] as const;

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest",     label: "Newest first" },
  { value: "oldest",     label: "Oldest first" },
  { value: "title-asc",  label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
  { value: "type",       label: "Type" },
  { value: "status",     label: "Status" },
];

// ── Props ───────────────────────────────────────────────────────────

interface DocumentFilterBarProps {
  activeTypes: Set<string>;
  activeStatuses: Set<string>;
  sortOption: SortOption;
  onTypesChange: (types: Set<string>) => void;
  onStatusesChange: (statuses: Set<string>) => void;
  onSortChange: (sort: SortOption) => void;
}

// ── Component ───────────────────────────────────────────────────────

function DocumentFilterBar({
  activeTypes,
  activeStatuses,
  sortOption,
  onTypesChange,
  onStatusesChange,
  onSortChange,
}: DocumentFilterBarProps) {
  function handleTypeChange(values: string[]) {
    onTypesChange(new Set(values));
  }

  function handleStatusChange(values: string[]) {
    onStatusesChange(new Set(values));
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border flex-wrap">
      {/* Type filters */}
      <ToggleGroup
        type="multiple"
        value={[...activeTypes]}
        onValueChange={handleTypeChange}
      >
        {KNOWN_DOC_TYPES.map((t) => (
          <ToggleGroupItem key={t} value={t} size="sm">
            {t}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Separator orientation="vertical" className="h-5" />

      {/* Status filters */}
      <ToggleGroup
        type="multiple"
        value={[...activeStatuses]}
        onValueChange={handleStatusChange}
      >
        {STATUS_TOGGLES.map((s) => (
          <ToggleGroupItem key={s.value} value={s.value} size="sm">
            <span
              className="mr-1 inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: s.colour }}
            />
            {s.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {/* Push sort to the right */}
      <div className="ml-auto">
        <Select
          value={sortOption}
          onValueChange={(v) => onSortChange(v as SortOption)}
        >
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export { DocumentFilterBar };
export type { DocumentFilterBarProps };
