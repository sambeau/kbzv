import {
  AlertCircle,
  Map,
  Puzzle,
  CheckSquare,
  Bug,
  Scale,
  CircleHelp,
  AlertOctagon,
  Lightbulb,
  HelpCircle,
  LayoutDashboard,
  MousePointerClick,
} from "lucide-react";
import { useProjectStore } from "@/lib/store/project-store";
import { resolveEntity } from "@/lib/query/references";
import { PlanDetail } from "./PlanDetail";
import { FeatureDetail } from "./FeatureDetail";
import { TaskDetail } from "./TaskDetail";
import { BugDetail } from "./BugDetail";
import { DecisionDetail } from "./DecisionDetail";
import { CheckpointDetail } from "./CheckpointDetail";
import { IncidentDetail } from "./IncidentDetail";
import { KnowledgeDetail } from "./KnowledgeDetail";
import { ProgressBar } from "@/components/metrics/ProgressBar";
import type { AnyEntity } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

// ── Props ───────────────────────────────────────────────────────────

interface EntityDetailProps {
  entityId: string | null;
  entityType: string | null;
}

// ── Entity type → component config ─────────────────────────────────

interface DetailConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.ComponentType<{ entity: any }>;
  icon: LucideIcon;
}

const DETAIL_COMPONENTS: Record<string, DetailConfig> = {
  plan: { component: PlanDetail, icon: Map },
  feature: { component: FeatureDetail, icon: Puzzle },
  task: { component: TaskDetail, icon: CheckSquare },
  bug: { component: BugDetail, icon: Bug },
  decision: { component: DecisionDetail, icon: Scale },
  checkpoint: { component: CheckpointDetail, icon: CircleHelp },
  incident: { component: IncidentDetail, icon: AlertOctagon },
  knowledge: { component: KnowledgeDetail, icon: Lightbulb },
};

// ── Default state components ────────────────────────────────────────

function ProjectSummary() {
  const plans = useProjectStore((s) => s.plans);
  const features = useProjectStore((s) => s.features);
  const tasks = useProjectStore((s) => s.tasks);
  const bugs = useProjectStore((s) => s.bugs);
  const decisions = useProjectStore((s) => s.decisions);
  const incidents = useProjectStore((s) => s.incidents);
  const pendingCheckpoints = useProjectStore((s) => s.pendingCheckpoints);

  const TASK_EXCLUDED = ["not-planned", "duplicate"];

  let overallDone = 0;
  let overallTotal = 0;
  for (const task of tasks.values()) {
    if (TASK_EXCLUDED.includes(task.status)) continue;
    overallTotal++;
    if (task.status === "done") overallDone++;
  }
  const overallPercentage =
    overallTotal > 0 ? Math.round((overallDone / overallTotal) * 100) : 0;

  const planCount = plans.size;
  const featureCount = features.size;
  const taskCount = tasks.size;
  const bugCount = bugs.size;
  const decisionCount = decisions.size;
  const incidentCount = incidents.size;
  const pendingCheckpointCount = pendingCheckpoints.length;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
      <LayoutDashboard className="w-12 h-12 text-muted-foreground/50" />

      <p className="text-sm">
        {planCount} Plans · {featureCount} Features · {taskCount} Tasks
      </p>

      <div className="w-48">
        <ProgressBar
          done={overallDone}
          total={overallTotal}
          percentage={overallPercentage}
          label="Overall"
        />
      </div>

      <p className="text-sm">
        {bugCount} Bugs · {decisionCount} Decisions · {incidentCount} Incidents
      </p>

      {pendingCheckpointCount > 0 && (
        <p className="text-sm text-orange-500 font-semibold">
          {pendingCheckpointCount} Pending Checkpoint
          {pendingCheckpointCount !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

function SelectEntityPrompt() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
      <MousePointerClick className="w-12 h-12 text-muted-foreground/50" />
      <p className="text-sm">Select an entity to view details</p>
    </div>
  );
}

// ── Generic fallback for unknown entity types ───────────────────────

function GenericDetail({ entity }: { entity: AnyEntity }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <HelpCircle className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-lg font-bold font-mono">{entity.id}</h2>
      </div>
      <dl className="space-y-2">
        {Object.entries(entity).map(([key, val]) => (
          <div key={key} className="space-y-0.5">
            <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {key}
            </dt>
            <dd className="text-sm font-mono">{String(val)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ── EntityDetail router ─────────────────────────────────────────────

function EntityDetail({ entityId, entityType }: EntityDetailProps) {
  const projectState = useProjectStore();
  const hasData = projectState.plans.size > 0 || projectState.features.size > 0;

  // No entity selected
  if (entityId === null) {
    return hasData ? <ProjectSummary /> : <SelectEntityPrompt />;
  }

  // Look up entity
  const resolved = resolveEntity(entityId, projectState);

  if (!resolved) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">
          Entity not found: <code className="font-mono">{entityId}</code>
        </p>
      </div>
    );
  }

  // Use provided entityType or fall back to resolved type
  const type = entityType ?? resolved.entityType;
  const config = DETAIL_COMPONENTS[type];

  if (!config) {
    return <GenericDetail entity={resolved.entity as AnyEntity} />;
  }

  const DetailComponent = config.component;
  return <DetailComponent entity={resolved.entity} />;
}

export { EntityDetail };
export type { EntityDetailProps };
