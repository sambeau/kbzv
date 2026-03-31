// src/components/document/DriftBadge.tsx

import { Badge } from "@radix-ui/themes";
import { CheckCircle, AlertTriangle, FileEdit, Archive } from "lucide-react";

// ── Props ───────────────────────────────────────────────────────────

interface DriftBadgeProps {
  status: string;
  contentHashExpected?: string;
  contentHashActual?: string;
  fileMissing?: boolean;
}

// ── State Resolution ────────────────────────────────────────────────

type DriftState =
  | "approved-clean"
  | "approved-modified"
  | "draft"
  | "superseded";

function resolveDriftState(props: DriftBadgeProps): DriftState {
  if (props.status === "superseded") return "superseded";
  if (props.status === "draft") return "draft";
  if (props.status === "approved") {
    if (props.fileMissing) return "approved-modified";
    if (!props.contentHashExpected) return "approved-clean";
    if (props.contentHashActual === props.contentHashExpected)
      return "approved-clean";
    return "approved-modified";
  }
  return "draft";
}

// ── Visuals ─────────────────────────────────────────────────────────

interface DriftVisual {
  label: string;
  color: "green" | "orange" | "gray" | "purple";
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}

const DRIFT_VISUALS: Record<DriftState, DriftVisual> = {
  "approved-clean": { label: "Approved", color: "green", Icon: CheckCircle },
  "approved-modified": {
    label: "Modified since approval",
    color: "orange",
    Icon: AlertTriangle,
  },
  draft: { label: "Draft", color: "gray", Icon: FileEdit },
  superseded: { label: "Superseded", color: "purple", Icon: Archive },
};

// ── Component ───────────────────────────────────────────────────────

function DriftBadge(props: DriftBadgeProps) {
  const state = resolveDriftState(props);
  const { label: defaultLabel, color, Icon } = DRIFT_VISUALS[state];

  // For unknown statuses that fell through to "draft", show the raw string
  const label =
    state === "draft" && props.status !== "draft" ? props.status : defaultLabel;

  return (
    <Badge color={color} variant="soft" style={{ gap: "0.25rem" }}>
      <Icon size={12} />
      {label}
    </Badge>
  );
}

export { DriftBadge };
export type { DriftBadgeProps, DriftState };
