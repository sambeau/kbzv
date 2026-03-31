import type { LucideIcon } from "lucide-react";
import { Separator, Table, DataList, Badge } from "@radix-ui/themes";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EntityLink } from "@/components/common/EntityLink";
import { StatusDot } from "@/components/tree/StatusDot";
import { cn } from "@/lib/utils";

// ── DetailHeader ────────────────────────────────────────────────────

interface DetailHeaderProps {
  icon: LucideIcon;
  entityId: string;
  summary: string;
  status: string;
  className?: string;
}

function DetailHeader({
  icon: Icon,
  entityId,
  summary,
  status,
  className,
}: DetailHeaderProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
        <h2 className="text-lg font-bold font-mono">{entityId}</h2>
      </div>
      {summary && <p className="text-base text-muted-foreground">{summary}</p>}
      <div className="pt-0.5">
        <Badge color={statusColor(status)} variant="solid" size="2">
          {status}
        </Badge>
      </div>
    </div>
  );
}

/** Map common lifecycle statuses to Radix badge colours */
function statusColor(
  status: string,
): React.ComponentProps<typeof Badge>["color"] {
  const s = status.toLowerCase();
  if (s === "done" || s === "approved" || s === "resolved" || s === "closed")
    return "green";
  if (s === "active" || s === "in-progress" || s === "investigating")
    return "blue";
  if (s === "ready" || s === "reported" || s === "triaged") return "yellow";
  if (
    s === "needs-review" ||
    s === "needs-rework" ||
    s === "blocked" ||
    s === "disputed"
  )
    return "orange";
  if (s === "cancelled" || s === "abandoned" || s === "rejected") return "red";
  if (s === "superseded") return "purple";
  return "gray";
}

// ── MetadataList ────────────────────────────────────────────────────
// Thin wrapper over Radix DataList for compact, aligned metadata rows.

interface MetadataItem {
  label: string;
  value: React.ReactNode;
}

function MetadataList({ items }: { items: MetadataItem[] }) {
  // Filter out items with no value
  const visible = items.filter(
    (item) => item.value != null && item.value !== "",
  );
  if (visible.length === 0) return null;

  return (
    <DataList.Root size="2">
      {visible.map((item) => (
        <DataList.Item key={item.label}>
          <DataList.Label minWidth="88px">
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </DataList.Label>
          <DataList.Value>
            <span className="text-sm">{item.value}</span>
          </DataList.Value>
        </DataList.Item>
      ))}
    </DataList.Root>
  );
}

// ── RelatedEntitiesSection ──────────────────────────────────────────

function RelatedEntitiesSection({
  title,
  headerContent,
  children,
}: {
  title: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Separator size="4" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {headerContent}
      <Table.Root
        variant="ghost"
        size="1"
        style={{ width: "auto", maxWidth: "100%" }}
      >
        <Table.Body>{children}</Table.Body>
      </Table.Root>
    </div>
  );
}

// ── RelatedEntityRow ────────────────────────────────────────────────
// Column order: status dot | title | entity ID

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
    <Table.Row>
      <Table.Cell style={{ width: "1.5rem", paddingRight: 0 }}>
        <StatusDot status={status} />
      </Table.Cell>
      <Table.Cell>
        <span className="text-sm text-muted-foreground truncate block">
          {summary}
        </span>
      </Table.Cell>
      <Table.Cell style={{ whiteSpace: "nowrap", width: "1%" }}>
        <EntityLink entityId={entityId} />
      </Table.Cell>
    </Table.Row>
  );
}

export { DetailHeader, MetadataList, RelatedEntitiesSection, RelatedEntityRow };
export type { DetailHeaderProps, MetadataItem };
