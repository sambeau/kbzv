import { useEffect } from "react";
import { FolderOpen } from "lucide-react";
import { DocumentsView } from "@/components/document/DocumentsView";
import { EmptyState } from "@/components/common/EmptyState";
import { WorkflowsView } from "@/views/WorkflowsView";
import { useUIStore } from "@/lib/store/ui-store";
import { open, message } from "@tauri-apps/plugin-dialog";
import { BugsView } from "@/views/BugsView";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

async function handleOpenProject(
  setProjectPath: (path: string | null) => void,
) {
  try {
    // 1. Open native folder picker
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Open Kanbanzai Project",
    });

    // 2. User cancelled
    if (selected === null) {
      return;
    }

    // 3. Validate via Rust command (bypasses fs plugin scope restrictions)
    const isValid = await invoke<boolean>("validate_project", {
      path: selected,
    });

    if (isValid) {
      // 4a. Valid project — store the path
      setProjectPath(selected);
    } else {
      // 4b. Invalid — show native error dialog
      await message(
        "The selected folder does not contain a .kbz/config.yaml file. Please select a folder that was initialised with Kanbanzai.",
        {
          title: "Not a Kanbanzai Project",
          kind: "error",
        },
      );
    }
  } catch (err) {
    console.error("handleOpenProject failed:", err);
    await message(
      `Failed to open project: ${err instanceof Error ? err.message : String(err)}`,
      {
        title: "Error Opening Project",
        kind: "error",
      },
    );
  }
}

function MainPanel() {
  const activeView = useUIStore((s) => s.activeView);
  const projectPath = useUIStore((s) => s.projectPath);
  const setProjectPath = useUIStore((s) => s.setProjectPath);

  // Listen for the native File → Open… menu item event
  useEffect(() => {
    const unlisten = listen("menu:open-project", () => {
      handleOpenProject(setProjectPath);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [setProjectPath]);

  // No project open — show open prompt
  if (!projectPath) {
    return (
      <main className="flex-1 overflow-auto">
        <EmptyState
          icon={FolderOpen}
          title="No project open"
          description="Select a Kanbanzai project folder to get started"
          action={{
            label: "Open Project",
            onClick: () => handleOpenProject(setProjectPath),
          }}
        />
      </main>
    );
  }

  // Project open — show view-specific content
  return (
    <main className="flex-1 overflow-hidden flex flex-col">
      {activeView === "documents" ? (
        <DocumentsView />
      ) : activeView === "bugs" ? (
        <BugsView />
      ) : (
        <WorkflowsView />
      )}
    </main>
  );
}

export { MainPanel };
