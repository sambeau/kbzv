import { FileText, GitBranch } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUIStore } from "@/lib/store/ui-store";
import type { ActiveView } from "@/lib/store/ui-store";

function HeaderBar() {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);

  const handleViewChange = (value: string) => {
    setActiveView(value as ActiveView);
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b bg-background px-4">
      {/* Left: View Switcher */}
      <Tabs value={activeView} onValueChange={handleViewChange}>
        <TabsList>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" />
            Docs
          </TabsTrigger>
          <TabsTrigger value="workflows" className="gap-2">
            <GitBranch className="h-4 w-4" />
            Workflows
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Right: Git info placeholder (Feature 6) */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {/* Reserved for Feature 6 git status display */}
      </div>
    </header>
  );
}

export { HeaderBar };
