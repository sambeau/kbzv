// src/components/layout/GitInfo.tsx

import { GitBranch, ArrowUp, ArrowDown } from 'lucide-react';
import { useProjectStore } from '@/lib/store/project-store';

/**
 * Read-only git status display for the header bar.
 * Renders nothing if no project is open or project is not a git repo.
 * No props — reads from the project store directly.
 */
export function GitInfo() {
  const gitStatus = useProjectStore((state) => state.gitStatus);

  if (!gitStatus) return null;

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      {/* Branch section: icon + repo / branch */}
      <div className="flex items-center gap-1.5">
        <GitBranch className="h-4 w-4 shrink-0" />
        <span className="truncate max-w-[120px]">{gitStatus.repoName}</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="truncate max-w-[160px] font-medium">
          {gitStatus.branch}
        </span>
      </div>

      {/* Separator */}
      <span className="text-muted-foreground/30">·</span>

      {/* Changes count */}
      <span className="tabular-nums whitespace-nowrap">
        {gitStatus.changesCount} {gitStatus.changesCount === 1 ? 'change' : 'changes'}
      </span>

      {/* Ahead/behind — only shown when upstream exists */}
      {gitStatus.ahead !== null && gitStatus.behind !== null && (
        <>
          <span className="text-muted-foreground/30">·</span>
          <div className="flex items-center gap-1.5 tabular-nums">
            <ArrowUp className="h-3.5 w-3.5" />
            <span>{gitStatus.ahead}</span>
            <span className="text-muted-foreground/50">|</span>
            <ArrowDown className="h-3.5 w-3.5" />
            <span>{gitStatus.behind}</span>
          </div>
        </>
      )}
    </div>
  );
}
