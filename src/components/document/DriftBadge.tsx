// src/components/document/DriftBadge.tsx

import { CheckCircle, AlertTriangle, FileEdit, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// ── Props ───────────────────────────────────────────────────────────

interface DriftBadgeProps {
  status: string;
  contentHashExpected?: string;
  contentHashActual?: string;
  fileMissing?: boolean;
}

// ── State Resolution ────────────────────────────────────────────────

type DriftState = "approved-clean" | "approved-modified" | "draft" | "superseded";

function resolveDriftState(props: DriftBadgeProps): DriftState {
  if (props.status === "superseded") return "superseded";
  if (props.status === "draft") return "draft";
  if (props.status === "approved") {
    if (props.fileMissing) return "approved-modified";
    if (!props.contentHashExpected) return "approved-clean"; // no hash to compare
    if (props.contentHashActual === props.contentHashExpected) return "approved-clean";
    return "approved-modified";
  }
  // Unknown status — render as draft-like (grey)
  return "draft";
}

// ── Visuals ─────────────────────────────────────────────────────────

const DRIFT_VISUALS: Record<
  DriftState,
  {
    label?: string;
    bg: string;
    text: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  "approved-clean":    { label: "Approved",                bg: "bg-green-100",  text: "text-green-800",  Icon: CheckCircle },
  "approved-modified": { label: "Modified since approval", bg: "bg-orange-100", text: "text-orange-800", Icon: AlertTriangle },
  "draft":             { label: "Draft",                   bg: "bg-gray-100",   text: "text-gray-600",   Icon: FileEdit },
  "superseded":        { label: "Superseded",              bg: "bg-purple-100", text: "text-purple-800", Icon: Archive },
};

// ── Component ───────────────────────────────────────────────────────

function DriftBadge(props: DriftBadgeProps) {
  const state = resolveDriftState(props);
  const visual = DRIFT_VISUALS[state];
  const Icon = visual.Icon;

  // For unknown statuses that fall through to "draft", show the raw string
  const label =
    state === "draft" && props.status !== "draft"
      ? props.status
      : visual.label;

  return (
    <Badge
      variant="secondary"
      className={cn(visual.bg, visual.text, "border-0 gap-1")}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}

export { DriftBadge };
export type { DriftBadgeProps, DriftState };
