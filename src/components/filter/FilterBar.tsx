// src/components/filter/FilterBar.tsx

import { Map, Puzzle, CheckSquare, Bug } from "lucide-react";
import { Separator } from "@radix-ui/themes";
import type { LucideIcon } from "lucide-react";
import { useUIStore } from "@/lib/store/ui-store";

// ── Entity types shown in Work view filter bar ──────────────────────

interface WorkflowEntityTypeInfo {
  type: string;
  label: string;
  icon: LucideIcon;
}

const WORKFLOW_ENTITY_TYPES: WorkflowEntityTypeInfo[] = [
  { type: "plan", label: "Plan", icon: Map },
  { type: "feature", label: "Feature", icon: Puzzle },
  { type: "task", label: "Task", icon: CheckSquare },
  { type: "bug", label: "Bug", icon: Bug },
];

// ── TypeCheckbox ────────────────────────────────────────────────────

interface TypeCheckboxProps {
  info: WorkflowEntityTypeInfo;
  isChecked: boolean;
  onToggle: () => void;
}

function TypeCheckbox({ info, isChecked, onToggle }: TypeCheckboxProps) {
  const Icon = info.icon;
  const id = `filter-type-${info.type}`;

  return (
    <label
      htmlFor={id}
      className="flex items-center gap-1.5 cursor-pointer select-none rounded px-2 py-1 text-sm transition-colors hover:bg-[var(--gray-3)]"
      style={{ color: isChecked ? "var(--gray-12)" : "var(--gray-10)" }}
    >
      <input
        id={id}
        type="checkbox"
        checked={isChecked}
        onChange={onToggle}
        className="h-3.5 w-3.5 cursor-pointer rounded"
        style={{ accentColor: "var(--accent-9)" }}
      />
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{info.label}</span>
    </label>
  );
}

// ── FilterBar ───────────────────────────────────────────────────────

function FilterBar() {
  const activeTypes = useUIStore((s) => s.activeTypes);
  const toggleType = useUIStore((s) => s.toggleType);

  return (
    <div>
      <div className="flex items-center gap-0.5 px-3 h-10 flex-wrap">
        {WORKFLOW_ENTITY_TYPES.map((info) => (
          <TypeCheckbox
            key={info.type}
            info={info}
            isChecked={activeTypes.has(info.type)}
            onToggle={() => toggleType(info.type)}
          />
        ))}
      </div>
      <Separator size="4" />
    </div>
  );
}

export { FilterBar };
