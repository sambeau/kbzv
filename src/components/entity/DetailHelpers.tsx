import type { LucideIcon } from "lucide-react";
import { Separator, Table } from "@radix-ui/themes";
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
      <p className="text-base text-muted-foreground">{summary}</p>
      <StatusBadge status={status} />
    </div>
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
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </h3>
      {headerContent}
      <Table.Root variant="ghost" size="1">
        <Table.Body>{children}</Table.Body>
      </Table.Root>
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
    <Table.Row>
      <Table.Cell style={{ width: "8rem" }}>
        <EntityLink entityId={entityId} />
      </Table.Cell>
      <Table.Cell>
        <span className="text-sm text-muted-foreground truncate block">
          {summary}
        </span>
      </Table.Cell>
      <Table.Cell style={{ width: "2rem" }} align="right">
        <StatusDot status={status} />
      </Table.Cell>
    </Table.Row>
  );
}

export { DetailHeader, RelatedEntitiesSection, RelatedEntityRow };
export type { DetailHeaderProps };
