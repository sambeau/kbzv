// src/components/document/DocumentFilterBar.tsx

import { Select, Separator } from "@radix-ui/themes";
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
  { value: "draft", label: "Draft", colour: "#9CA3AF" },
  { value: "superseded", label: "Superseded", colour: "#A855F7" },
] as const;

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
  { value: "type", label: "Type" },
  { value: "status", label: "Status" },
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

// ── Checkbox label component ────────────────────────────────────────

function FilterCheckbox({
  id,
  label,
  checked,
  onChange,
  dot,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: () => void;
  dot?: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-1.5 cursor-pointer select-none rounded px-2 py-1 text-sm transition-colors hover:bg-[var(--gray-3)]"
      style={{ color: checked ? "var(--gray-12)" : "var(--gray-10)" }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 cursor-pointer rounded"
        style={{ accentColor: "var(--accent-9)" }}
      />
      {dot && (
        <span
          className="inline-block h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: dot }}
        />
      )}
      {label}
    </label>
  );
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
  function toggleType(type: string) {
    const next = new Set(activeTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    onTypesChange(next);
  }

  function toggleStatus(status: string) {
    const next = new Set(activeStatuses);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    onStatusesChange(next);
  }

  return (
    <div>
      <div className="flex items-center gap-1 px-3 h-10 flex-wrap">
        {/* Type filters */}
        {KNOWN_DOC_TYPES.map((t) => (
          <FilterCheckbox
            key={t}
            id={`doc-type-${t}`}
            label={t}
            checked={activeTypes.has(t)}
            onChange={() => toggleType(t)}
          />
        ))}

        <Separator
          orientation="vertical"
          style={{ height: "1.25rem", margin: "0 0.25rem" }}
        />

        {/* Status filters */}
        {STATUS_TOGGLES.map((s) => (
          <FilterCheckbox
            key={s.value}
            id={`doc-status-${s.value}`}
            label={s.label}
            checked={activeStatuses.has(s.value)}
            onChange={() => toggleStatus(s.value)}
            dot={s.colour}
          />
        ))}

        {/* Sort — pushed to the right */}
        <div className="ml-auto">
          <Select.Root
            value={sortOption}
            onValueChange={(v) => onSortChange(v as SortOption)}
            size="1"
          >
            <Select.Trigger />
            <Select.Content>
              {SORT_OPTIONS.map((o) => (
                <Select.Item key={o.value} value={o.value}>
                  {o.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </div>
      </div>
      <Separator size="4" />
    </div>
  );
}

export { DocumentFilterBar };
export type { DocumentFilterBarProps };
