import { useEffect, useRef } from "react";
import { FolderOpen } from "lucide-react";
import { DocumentsView } from "@/components/document/DocumentsView";
import { EmptyState } from "@/components/common/EmptyState";
import { WorkflowsView } from "@/views/WorkflowsView";
import { useUIStore } from "@/lib/store/ui-store";
import { BugsView } from "@/views/BugsView";
import { validateProject } from "@/lib/reader/fs";

// ── Tauri-only imports (lazy) ───────────────────────────────────────
// These are dynamically imported so the browser build doesn't explode
// when @tauri-apps/* modules aren't available in the runtime.

async function tauriOpen(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Open Kanbanzai Project",
  });
  return selected;
}

async function tauriMessage(
  msg: string,
  opts: { title: string; kind: string },
) {
  const { message } = await import("@tauri-apps/plugin-dialog");
  await message(msg, opts as Parameters<typeof message>[1]);
}

async function tauriListen(
  event: string,
  handler: () => void,
): Promise<() => void> {
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen(event, handler);
  return unlisten;
}

function hasTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

// ── Query string helper ─────────────────────────────────────────────

function getProjectFromQueryString(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("project");
}

// ── Open project handler ────────────────────────────────────────────

async function handleOpenProject(
  setProjectPath: (path: string | null) => void,
) {
  try {
    // 1. Open native folder picker (Tauri only)
    const selected = await tauriOpen();

    // 2. User cancelled
    if (selected === null) return;

    // 3. Validate
    const isValid = await validateProject(selected);

    if (isValid) {
      setProjectPath(selected);
    } else {
      await tauriMessage(
        "The selected folder does not contain a .kbz/config.yaml file. Please select a folder that was initialised with Kanbanzai.",
        { title: "Not a Kanbanzai Project", kind: "error" },
      );
    }
  } catch (err) {
    console.error("handleOpenProject failed:", err);
    if (hasTauri()) {
      await tauriMessage(
        `Failed to open project: ${err instanceof Error ? err.message : String(err)}`,
        { title: "Error Opening Project", kind: "error" },
      );
    }
  }
}

function MainPanel() {
  const activeView = useUIStore((s) => s.activeView);
  const projectPath = useUIStore((s) => s.projectPath);
  const setProjectPath = useUIStore((s) => s.setProjectPath);
  const autoLoadAttempted = useRef(false);

  // Auto-load from ?project= query string (browser dev mode)
  useEffect(() => {
    if (autoLoadAttempted.current || projectPath) return;
    autoLoadAttempted.current = true;

    const qsPath = getProjectFromQueryString();
    if (!qsPath) return;

    validateProject(qsPath).then((isValid) => {
      if (isValid) {
        console.log(
          `[MainPanel] Auto-loading project from query string: ${qsPath}`,
        );
        setProjectPath(qsPath);
      } else {
        console.warn(
          `[MainPanel] ?project= path is not a valid Kanbanzai project: ${qsPath}`,
        );
      }
    });
  }, [projectPath, setProjectPath]);

  // Listen for the native File → Open… menu item event (Tauri only)
  useEffect(() => {
    if (!hasTauri()) return;

    let cleanup: (() => void) | null = null;
    tauriListen("menu:open-project", () => {
      handleOpenProject(setProjectPath);
    }).then((unlisten) => {
      cleanup = unlisten;
    });

    return () => {
      cleanup?.();
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
