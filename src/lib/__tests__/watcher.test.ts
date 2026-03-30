// src/lib/__tests__/watcher.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Hoisted mock state ───────────────────────────────────────────────
// vi.hoisted ensures these values are available when vi.mock factories run

const mockFsState = vi.hoisted(() => ({
  callbacks: [] as Array<(event: unknown) => void>,
  unwatchFns: [] as ReturnType<typeof vi.fn>[],
  paths: [] as string[],
  reset() {
    this.callbacks = [];
    this.unwatchFns = [];
    this.paths = [];
  },
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  watch: vi.fn(
    async (
      path: unknown,
      cb: (event: unknown) => void,
      _opts?: unknown,
    ): Promise<() => void> => {
      const unsub = vi.fn();
      mockFsState.callbacks.push(cb);
      mockFsState.unwatchFns.push(unsub);
      mockFsState.paths.push(path as string);
      return unsub;
    },
  ),
}));

// Sequential git command responses via a call counter
const mockShellState = vi.hoisted(() => ({
  responses: null as Array<{
    code: number;
    stdout: string;
    stderr: string;
  }> | null,
  callIndex: 0,
  reset(responses?: Array<{ code: number; stdout: string; stderr: string }>) {
    this.responses = responses ?? null;
    this.callIndex = 0;
  },
}));

vi.mock("@tauri-apps/plugin-shell", () => ({
  Command: {
    create: vi.fn((_name: string, _args: string[], _opts?: unknown) => ({
      execute: () => {
        if (!mockShellState.responses) {
          return Promise.resolve({
            code: 128,
            stdout: "",
            stderr: "not a git repository",
          });
        }
        const idx = mockShellState.callIndex;
        mockShellState.callIndex += 1;
        const response = mockShellState.responses[idx] ?? {
          code: 1,
          stdout: "",
          stderr: "no more responses",
        };
        return Promise.resolve(response);
      },
    })),
  },
}));

// ── Imports (after mocks) ────────────────────────────────────────────

import { startWatching, stopWatching } from "../reader/watcher";
import type { WatcherHandle, WatcherCallbacks } from "../reader/watcher";
import { fetchGitStatus } from "../reader/git";
import type { ProjectConfig } from "../types/config";

// ── Test helpers ─────────────────────────────────────────────────────

const PROJECT_PATH = "/home/user/myproject";

const NO_DOCS_CONFIG = {
  documents: { roots: [] },
} as unknown as ProjectConfig;

const WITH_DOCS_CONFIG = {
  documents: {
    roots: [
      { path: "work/spec", default_type: "specification" },
      { path: "work/design", default_type: "design" },
    ],
  },
} as unknown as ProjectConfig;

function makeCbs() {
  return {
    reloadEntity: vi.fn().mockResolvedValue(undefined),
    removeEntity: vi.fn(),
    rebuildDerivedData: vi.fn(),
    refreshGitStatus: vi.fn().mockResolvedValue(undefined),
    invalidateContentHash: vi.fn(),
  };
}

function makeEvent(
  type: Record<string, unknown> | string,
  paths: string[],
): { type: Record<string, unknown> | string; paths: string[]; attrs: unknown } {
  return { type, paths, attrs: {} };
}

function fire(cbIndex: number, event: unknown) {
  mockFsState.callbacks[cbIndex](event);
}

// ── startWatching / stopWatching ─────────────────────────────────────

describe("startWatching", () => {
  beforeEach(() => {
    mockFsState.reset();
  });

  it("watches .kbz/state/ directory", async () => {
    const handle = await startWatching(
      PROJECT_PATH,
      NO_DOCS_CONFIG,
      makeCbs() as unknown as WatcherCallbacks,
    );
    expect(mockFsState.paths).toContain(`${PROJECT_PATH}/.kbz/state`);
    stopWatching(handle);
  });

  it("creates one watcher per document root plus one for state", async () => {
    const handle = await startWatching(
      PROJECT_PATH,
      WITH_DOCS_CONFIG,
      makeCbs() as unknown as WatcherCallbacks,
    );
    expect(mockFsState.callbacks).toHaveLength(3);
    expect(mockFsState.paths).toContain(`${PROJECT_PATH}/work/spec`);
    expect(mockFsState.paths).toContain(`${PROJECT_PATH}/work/design`);
    stopWatching(handle);
  });

  it("creates only state watcher when no doc roots configured", async () => {
    const handle = await startWatching(
      PROJECT_PATH,
      NO_DOCS_CONFIG,
      makeCbs() as unknown as WatcherCallbacks,
    );
    expect(mockFsState.callbacks).toHaveLength(1);
    stopWatching(handle);
  });
});

describe("stopWatching", () => {
  beforeEach(() => {
    mockFsState.reset();
  });

  it("calls all unwatch functions", async () => {
    const handle = await startWatching(
      PROJECT_PATH,
      WITH_DOCS_CONFIG,
      makeCbs() as unknown as WatcherCallbacks,
    );
    stopWatching(handle);
    for (const unsub of mockFsState.unwatchFns) {
      expect(unsub).toHaveBeenCalledOnce();
    }
  });

  it("allows a new startWatching after stopping", async () => {
    const h1 = await startWatching(
      PROJECT_PATH,
      NO_DOCS_CONFIG,
      makeCbs() as unknown as WatcherCallbacks,
    );
    stopWatching(h1);
    mockFsState.reset();

    const h2 = await startWatching(
      "/other/project",
      NO_DOCS_CONFIG,
      makeCbs() as unknown as WatcherCallbacks,
    );
    expect(mockFsState.paths).toContain("/other/project/.kbz/state");
    stopWatching(h2);
  });
});

// ── Event classification ─────────────────────────────────────────────

describe("event classification", () => {
  let handle: WatcherHandle;
  let cbs: ReturnType<typeof makeCbs>;

  const YAML_PATH = `${PROJECT_PATH}/.kbz/state/tasks/TASK-01ABCDEFGHIJK-my-task.yaml`;

  beforeEach(async () => {
    mockFsState.reset();
    vi.useFakeTimers();
    cbs = makeCbs();
    handle = await startWatching(
      PROJECT_PATH,
      NO_DOCS_CONFIG,
      cbs as unknown as WatcherCallbacks,
    );
  });

  afterEach(() => {
    stopWatching(handle);
    vi.useRealTimers();
  });

  it("calls reloadEntity for create events", async () => {
    fire(0, makeEvent({ create: { kind: "file" } }, [YAML_PATH]));
    await vi.runAllTimersAsync();
    expect(cbs.reloadEntity).toHaveBeenCalledWith("task", YAML_PATH);
  });

  it("calls reloadEntity for modify events", async () => {
    fire(
      0,
      makeEvent({ modify: { kind: "data", mode: "content" } }, [YAML_PATH]),
    );
    await vi.runAllTimersAsync();
    expect(cbs.reloadEntity).toHaveBeenCalledWith("task", YAML_PATH);
  });

  it("calls removeEntity with resolved entity ID for delete events", async () => {
    fire(0, makeEvent({ remove: { kind: "file" } }, [YAML_PATH]));
    await vi.runAllTimersAsync();
    expect(cbs.removeEntity).toHaveBeenCalledWith("task", "TASK-01ABCDEFGHIJK");
  });

  it("ignores string type events such as 'any'", async () => {
    fire(0, makeEvent("any", [YAML_PATH]));
    await vi.runAllTimersAsync();
    expect(cbs.reloadEntity).not.toHaveBeenCalled();
    expect(cbs.removeEntity).not.toHaveBeenCalled();
  });

  it("ignores access object events", async () => {
    fire(0, makeEvent({ access: { kind: "read" } }, [YAML_PATH]));
    await vi.runAllTimersAsync();
    expect(cbs.reloadEntity).not.toHaveBeenCalled();
    expect(cbs.removeEntity).not.toHaveBeenCalled();
  });
});

// ── File filtering ────────────────────────────────────────────────────

describe("file filtering", () => {
  let handle: WatcherHandle;
  let cbs: ReturnType<typeof makeCbs>;

  beforeEach(async () => {
    mockFsState.reset();
    vi.useFakeTimers();
    cbs = makeCbs();
    handle = await startWatching(
      PROJECT_PATH,
      WITH_DOCS_CONFIG,
      cbs as unknown as WatcherCallbacks,
    );
  });

  afterEach(() => {
    stopWatching(handle);
    vi.useRealTimers();
  });

  it("ignores non-.yaml files in state/", async () => {
    fire(
      0,
      makeEvent({ create: { kind: "file" } }, [
        `${PROJECT_PATH}/.kbz/state/tasks/TASK-01ABCDEFGHIJK-test.txt`,
      ]),
    );
    await vi.runAllTimersAsync();
    expect(cbs.reloadEntity).not.toHaveBeenCalled();
  });

  it("processes .md files in document roots and calls invalidateContentHash", async () => {
    const mdPath = `${PROJECT_PATH}/work/spec/my-doc.md`;
    // callbacks[1] = work/spec watcher
    fire(1, makeEvent({ modify: { kind: "data", mode: "content" } }, [mdPath]));
    await vi.runAllTimersAsync();
    expect(cbs.invalidateContentHash).toHaveBeenCalledWith([mdPath]);
  });

  it("ignores non-.md files in document roots", async () => {
    fire(
      1,
      makeEvent({ create: { kind: "file" } }, [
        `${PROJECT_PATH}/work/spec/some-doc.yaml`,
      ]),
    );
    await vi.runAllTimersAsync();
    expect(cbs.invalidateContentHash).not.toHaveBeenCalled();
  });
});

// ── Entity type and ID resolution ────────────────────────────────────

describe("entity type and ID resolution", () => {
  let handle: WatcherHandle;
  let cbs: ReturnType<typeof makeCbs>;

  beforeEach(async () => {
    mockFsState.reset();
    vi.useFakeTimers();
    cbs = makeCbs();
    handle = await startWatching(
      PROJECT_PATH,
      NO_DOCS_CONFIG,
      cbs as unknown as WatcherCallbacks,
    );
  });

  afterEach(() => {
    stopWatching(handle);
    vi.useRealTimers();
  });

  async function checkDeleteResolution(
    dir: string,
    filename: string,
    expectedType: string,
    expectedId: string,
  ) {
    const path = `${PROJECT_PATH}/.kbz/state/${dir}/${filename}`;
    fire(0, makeEvent({ remove: { kind: "file" } }, [path]));
    await vi.runAllTimersAsync();
    expect(cbs.removeEntity).toHaveBeenCalledWith(expectedType, expectedId);
    cbs.removeEntity.mockClear();
    await vi.runAllTimersAsync();
  }

  it("resolves plan — simple ID is the full filename stem", async () => {
    await checkDeleteResolution("plans", "P1-kbzv.yaml", "plan", "P1-kbzv");
  });

  it("resolves feature — strips slug suffix", async () => {
    await checkDeleteResolution(
      "features",
      "FEAT-01KMZA9PWFRJF-file-watching-git-status.yaml",
      "feature",
      "FEAT-01KMZA9PWFRJF",
    );
  });

  it("resolves task — strips slug suffix", async () => {
    await checkDeleteResolution(
      "tasks",
      "TASK-01KMZA9Q1ABCD-implement-watcher.yaml",
      "task",
      "TASK-01KMZA9Q1ABCD",
    );
  });

  it("resolves bug — strips slug suffix", async () => {
    await checkDeleteResolution(
      "bugs",
      "BUG-01KMZB1234567-null-pointer.yaml",
      "bug",
      "BUG-01KMZB1234567",
    );
  });

  it("resolves decision — strips slug suffix", async () => {
    await checkDeleteResolution(
      "decisions",
      "DEC-01KMZA9123456-use-zustand.yaml",
      "decision",
      "DEC-01KMZA9123456",
    );
  });

  it("resolves knowledge — simple ID is the full filename stem", async () => {
    await checkDeleteResolution(
      "knowledge",
      "KE-01JX1234567AB.yaml",
      "knowledge",
      "KE-01JX1234567AB",
    );
  });

  it("resolves incident — strips slug suffix", async () => {
    await checkDeleteResolution(
      "incidents",
      "INC-01KMZC7654321-prod-outage.yaml",
      "incident",
      "INC-01KMZC7654321",
    );
  });

  it("resolves checkpoint — simple ID is the full filename stem", async () => {
    await checkDeleteResolution(
      "checkpoints",
      "CHK-01JX9876543FG.yaml",
      "checkpoint",
      "CHK-01JX9876543FG",
    );
  });

  it("ignores files outside .kbz/state/", async () => {
    fire(
      0,
      makeEvent({ create: { kind: "file" } }, [
        `${PROJECT_PATH}/work/design/not-state.yaml`,
      ]),
    );
    await vi.runAllTimersAsync();
    expect(cbs.reloadEntity).not.toHaveBeenCalled();
    expect(cbs.removeEntity).not.toHaveBeenCalled();
  });

  it("ignores files nested deeper than the entity-type directory", async () => {
    fire(
      0,
      makeEvent({ create: { kind: "file" } }, [
        `${PROJECT_PATH}/.kbz/state/tasks/subdir/TASK-01ABCDEFGHIJK-nested.yaml`,
      ]),
    );
    await vi.runAllTimersAsync();
    expect(cbs.reloadEntity).not.toHaveBeenCalled();
  });
});

// ── Debounce batching ────────────────────────────────────────────────

describe("debounce batching", () => {
  let handle: WatcherHandle;
  let cbs: ReturnType<typeof makeCbs>;

  beforeEach(async () => {
    mockFsState.reset();
    vi.useFakeTimers();
    cbs = makeCbs();
    handle = await startWatching(
      PROJECT_PATH,
      WITH_DOCS_CONFIG,
      cbs as unknown as WatcherCallbacks,
    );
  });

  afterEach(() => {
    stopWatching(handle);
    vi.useRealTimers();
  });

  it("batches two state events into one rebuildDerivedData call", async () => {
    const f1 = `${PROJECT_PATH}/.kbz/state/tasks/TASK-01ABCDEFGHIJK-t1.yaml`;
    const f2 = `${PROJECT_PATH}/.kbz/state/features/FEAT-01ABCDEFGHIJK-f1.yaml`;

    fire(0, makeEvent({ modify: { kind: "data", mode: "content" } }, [f1]));
    fire(0, makeEvent({ modify: { kind: "data", mode: "content" } }, [f2]));
    await vi.runAllTimersAsync();

    expect(cbs.reloadEntity).toHaveBeenCalledTimes(2);
    expect(cbs.rebuildDerivedData).toHaveBeenCalledOnce();
  });

  it("deduplicates multiple events for the same path — last event survives", async () => {
    const filePath = `${PROJECT_PATH}/.kbz/state/tasks/TASK-01ABCDEFGHIJK-t1.yaml`;

    fire(0, makeEvent({ create: { kind: "file" } }, [filePath]));
    fire(
      0,
      makeEvent({ modify: { kind: "data", mode: "content" } }, [filePath]),
    );
    await vi.runAllTimersAsync();

    // Two events for same file → deduped → only one reloadEntity call
    expect(cbs.reloadEntity).toHaveBeenCalledTimes(1);
  });

  it("calls refreshGitStatus once per flush", async () => {
    fire(
      0,
      makeEvent({ modify: { kind: "data", mode: "content" } }, [
        `${PROJECT_PATH}/.kbz/state/tasks/TASK-01ABCDEFGHIJK-t1.yaml`,
      ]),
    );
    await vi.runAllTimersAsync();
    expect(cbs.refreshGitStatus).toHaveBeenCalledOnce();
  });

  it("does not call rebuildDerivedData when only document events arrive", async () => {
    // callbacks[1] is the work/spec doc root watcher
    fire(
      1,
      makeEvent({ modify: { kind: "data", mode: "content" } }, [
        `${PROJECT_PATH}/work/spec/my-doc.md`,
      ]),
    );
    await vi.runAllTimersAsync();

    expect(cbs.rebuildDerivedData).not.toHaveBeenCalled();
    expect(cbs.invalidateContentHash).toHaveBeenCalled();
  });

  it("passes all document paths to invalidateContentHash in one call", async () => {
    const p1 = `${PROJECT_PATH}/work/spec/doc-a.md`;
    const p2 = `${PROJECT_PATH}/work/design/doc-b.md`;

    // Fire to doc watcher indices 1 (work/spec) and 2 (work/design)
    fire(1, makeEvent({ modify: { kind: "data", mode: "content" } }, [p1]));
    fire(2, makeEvent({ modify: { kind: "data", mode: "content" } }, [p2]));
    await vi.runAllTimersAsync();

    // Both paths sent in a single invalidateContentHash call
    expect(cbs.invalidateContentHash).toHaveBeenCalledOnce();
    const arg = cbs.invalidateContentHash.mock.calls[0][0] as string[];
    expect(arg).toContain(p1);
    expect(arg).toContain(p2);
  });
});

// ── fetchGitStatus ───────────────────────────────────────────────────

describe("fetchGitStatus", () => {
  beforeEach(() => {
    mockShellState.reset();
  });

  it("returns null when the directory is not a git repository", async () => {
    mockShellState.reset([
      { code: 128, stdout: "", stderr: "not a git repository" },
    ]);
    const result = await fetchGitStatus("/not/a/repo");
    expect(result).toBeNull();
  });

  it("returns a GitStatus object on success", async () => {
    mockShellState.reset([
      { code: 0, stdout: "main\n", stderr: "" }, // branch
      { code: 0, stdout: "", stderr: "" }, // status (clean)
      { code: 1, stdout: "", stderr: "no upstream" }, // no upstream
    ]);
    const result = await fetchGitStatus("/some/project");
    expect(result).not.toBeNull();
  });

  it("extracts repo name from the last path segment", async () => {
    mockShellState.reset([
      { code: 0, stdout: "main\n", stderr: "" },
      { code: 0, stdout: "", stderr: "" },
      { code: 1, stdout: "", stderr: "" },
    ]);
    const result = await fetchGitStatus("/home/user/my-project");
    expect(result?.repoName).toBe("my-project");
  });

  it("trims branch name from rev-parse output", async () => {
    mockShellState.reset([
      { code: 0, stdout: "feat/file-watching\n", stderr: "" },
      { code: 0, stdout: "", stderr: "" },
      { code: 1, stdout: "", stderr: "" },
    ]);
    const result = await fetchGitStatus("/some/project");
    expect(result?.branch).toBe("feat/file-watching");
  });

  it("counts non-empty lines in porcelain output as changesCount", async () => {
    mockShellState.reset([
      { code: 0, stdout: "main\n", stderr: "" },
      {
        code: 0,
        stdout: " M src/file1.ts\n?? new-file.txt\nA  staged.ts\n",
        stderr: "",
      },
      { code: 1, stdout: "", stderr: "" },
    ]);
    const result = await fetchGitStatus("/some/project");
    expect(result?.changesCount).toBe(3);
  });

  it("returns changesCount 0 for a clean working tree", async () => {
    mockShellState.reset([
      { code: 0, stdout: "main\n", stderr: "" },
      { code: 0, stdout: "", stderr: "" }, // empty porcelain output
      { code: 1, stdout: "", stderr: "" },
    ]);
    const result = await fetchGitStatus("/some/project");
    expect(result?.changesCount).toBe(0);
  });

  it("parses ahead and behind counts from rev-list output", async () => {
    mockShellState.reset([
      { code: 0, stdout: "feature/my-branch\n", stderr: "" },
      { code: 0, stdout: " M file.ts\n", stderr: "" },
      { code: 0, stdout: "3\t1\n", stderr: "" },
    ]);
    const result = await fetchGitStatus("/some/project");
    expect(result?.ahead).toBe(3);
    expect(result?.behind).toBe(1);
  });

  it("returns null ahead/behind when no upstream is configured", async () => {
    mockShellState.reset([
      { code: 0, stdout: "main\n", stderr: "" },
      { code: 0, stdout: "", stderr: "" },
      {
        code: 1,
        stdout: "",
        stderr: "no upstream configured for branch 'main'",
      },
    ]);
    const result = await fetchGitStatus("/some/project");
    expect(result?.ahead).toBeNull();
    expect(result?.behind).toBeNull();
  });

  it("returns branch name HEAD for detached HEAD state", async () => {
    mockShellState.reset([
      { code: 0, stdout: "HEAD\n", stderr: "" },
      { code: 0, stdout: "", stderr: "" },
      { code: 1, stdout: "", stderr: "" },
    ]);
    const result = await fetchGitStatus("/some/project");
    expect(result?.branch).toBe("HEAD");
  });
});
