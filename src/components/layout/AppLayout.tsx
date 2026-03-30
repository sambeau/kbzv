import { HeaderBar } from "./HeaderBar";
import { MainPanel } from "./MainPanel";

function AppLayout() {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <HeaderBar />
      <MainPanel />
    </div>
  );
}

export { AppLayout };
