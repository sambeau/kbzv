import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUIStore } from "@/lib/store/ui-store";

function App() {
  const navigateBack = useUIStore((s) => s.navigateBack);
  const navigateForward = useUIStore((s) => s.navigateForward);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey) return;
      // Ignore if other modifiers are held (e.g. ⌘⇧[ for tab switching)
      if (e.shiftKey || e.ctrlKey || e.altKey) return;

      if (e.key === "[") {
        e.preventDefault();
        e.stopPropagation();
        navigateBack();
        return;
      }

      if (e.key === "]") {
        e.preventDefault();
        e.stopPropagation();
        navigateForward();
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigateBack, navigateForward]);

  return (
    <TooltipProvider>
      <AppLayout />
    </TooltipProvider>
  );
}

export default App;
