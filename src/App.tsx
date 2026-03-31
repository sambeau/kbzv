import { useEffect } from "react";
import { Theme } from "@radix-ui/themes";
import { AppLayout } from "@/components/layout/AppLayout";
import { useUIStore } from "@/lib/store/ui-store";

function App() {
  const navigateBack = useUIStore((s) => s.navigateBack);
  const navigateForward = useUIStore((s) => s.navigateForward);
  const themeAppearance = useUIStore((s) => s.themeAppearance);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey) return;
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
    <Theme
      accentColor="sky"
      grayColor="slate"
      radius="medium"
      appearance={themeAppearance}
    >
      <AppLayout />
    </Theme>
  );
}

export default App;
