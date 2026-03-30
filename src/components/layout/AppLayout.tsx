import { useEffect } from "react";
import { HeaderBar } from "./HeaderBar";
import { MainPanel } from "./MainPanel";
import { useUIStore } from "@/lib/store/ui-store";
import { useProjectStore } from "@/lib/store/project-store";

function AppLayout() {
  const projectPath = useUIStore((s) => s.projectPath);
  const openProject = useProjectStore((s) => s.openProject);
  const closeProject = useProjectStore((s) => s.closeProject);

  useEffect(() => {
    if (projectPath) {
      openProject(projectPath);
    } else {
      closeProject();
    }
  }, [projectPath, openProject, closeProject]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <HeaderBar />
      <MainPanel />
    </div>
  );
}

export { AppLayout };
