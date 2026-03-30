import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "../ui-store";

describe("ui-store", () => {
  beforeEach(() => {
    useUIStore.setState({ projectPath: null, activeView: "documents" });
  });

  it("defaults to no project and documents view", () => {
    const state = useUIStore.getState();
    expect(state.projectPath).toBeNull();
    expect(state.activeView).toBe("documents");
  });

  it("setProjectPath updates projectPath", () => {
    useUIStore.getState().setProjectPath("/path/to/project");
    expect(useUIStore.getState().projectPath).toBe("/path/to/project");
  });

  it("setProjectPath(null) clears the project", () => {
    useUIStore.getState().setProjectPath("/path/to/project");
    useUIStore.getState().setProjectPath(null);
    expect(useUIStore.getState().projectPath).toBeNull();
  });

  it("setActiveView switches the view", () => {
    useUIStore.getState().setActiveView("workflows");
    expect(useUIStore.getState().activeView).toBe("workflows");
  });
});
