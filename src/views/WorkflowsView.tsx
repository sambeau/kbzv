import { useUIStore } from '@/lib/store/ui-store';
import { TreeProvider } from '@/components/tree/TreeContext';
import { FilterBar } from '@/components/filter/FilterBar';
import { EntityTree } from '@/components/tree/EntityTree';
import { EntityDetail } from '@/components/entity/EntityDetail';

function WorkflowsView() {
  const selectedEntityId = useUIStore((s) => s.selectedEntityId);
  const selectedEntityType = useUIStore((s) => s.selectedEntityType);

  return (
    <TreeProvider>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Filter bar — fixed, spans full width */}
        <FilterBar />

        {/* Two-column split below filter bar */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left column — Entity Tree */}
          <div className="w-80 min-w-[280px] overflow-y-auto border-r">
            <EntityTree />
          </div>

          {/* Right column — Entity Detail */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[700px] p-6">
              <EntityDetail
                entityId={selectedEntityId}
                entityType={selectedEntityType}
              />
            </div>
          </div>
        </div>
      </div>
    </TreeProvider>
  );
}

export { WorkflowsView };
