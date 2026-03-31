import { FileText, ListChecks, Bug, Sun, Moon } from "lucide-react";
import { Tabs, IconButton, Separator } from "@radix-ui/themes";
import { GitInfo } from "@/components/layout/GitInfo";
import { useUIStore } from "@/lib/store/ui-store";
import type { ActiveView } from "@/lib/store/ui-store";

function HeaderBar() {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const themeAppearance = useUIStore((s) => s.themeAppearance);
  const toggleThemeAppearance = useUIStore((s) => s.toggleThemeAppearance);

  return (
    <header className="relative flex h-12 shrink-0 items-stretch bg-background">
      {/* Full-width tabs — the Tabs.List bottom border spans the entire header */}
      <Tabs.Root
        value={activeView}
        onValueChange={(v) => setActiveView(v as ActiveView)}
        className="flex-1"
        color="indigo"
      >
        <Tabs.List className="w-full h-12 px-4">
          <Tabs.Trigger value="documents" style={{ gap: "0.375rem" }}>
            <FileText size={14} />
            Docs
          </Tabs.Trigger>
          <Tabs.Trigger value="workflows" style={{ gap: "0.375rem" }}>
            <ListChecks size={14} />
            Work
          </Tabs.Trigger>
          <Tabs.Trigger value="bugs" style={{ gap: "0.375rem" }}>
            <Bug size={14} />
            Bugs
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      {/* Right controls — absolutely positioned so they don't affect tab width */}
      <div className="absolute right-4 top-0 bottom-0 flex items-center gap-2">
        <GitInfo />
        <Separator orientation="vertical" style={{ height: "1.25rem" }} />
        <IconButton
          variant="ghost"
          size="1"
          color="gray"
          onClick={toggleThemeAppearance}
          aria-label="Toggle dark mode"
        >
          {themeAppearance === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </IconButton>
      </div>
    </header>
  );
}

export { HeaderBar };
