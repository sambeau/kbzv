# F1: App Scaffold + Theme — Development Plan

**Feature:** FEAT-01KMZA96W1J98 (`app-scaffold-theme`)
**Parent Plan:** P1-kbzv
**Specification:** [F1 Specification](../spec/f1-app-scaffold-theme-spec.md)
**Design:** [F1 Design Document](../design/f1-app-scaffold-theme.md)

---

## Overview

Feature 1 delivers a running Tauri v2 desktop application with a React/TypeScript frontend, the KBZV theme (Nova/Mist/Sky via shadcn/ui), a two-view layout shell with header bar and view switcher, and a native project-open dialog. After this feature is complete, `pnpm tauri dev` launches a styled desktop window where a user can open a Kanbanzai project folder and switch between two placeholder views.

The work is divided into **6 tasks** totalling **18.5 story points**. Tasks are ordered by dependency — each builds on the output of previous tasks. The first three tasks create infrastructure (Tauri scaffold, frontend tooling, theming); the last three build application functionality (state, layout, and the project-open flow).

---

## Task Dependency Graph

```
Task 1: Tauri v2 Project Scaffold ─────────────┐
                                                │
Task 2: Frontend Foundation ────────────────────┤
                                                │
Task 3: Tailwind CSS + shadcn/ui Setup ─────────┤
                                                ▼
                                    Task 4: UI Store
                                                │
                                                ▼
                                Task 5: Layout Shell + View Switcher
                                                │
                                                ▼
                                  Task 6: Project Open Flow
```

Tasks 1, 2, and 3 form the infrastructure layer. Each depends on the prior:
- Task 2 needs the Tauri scaffold from Task 1
- Task 3 needs the Vite/React setup from Task 2

Tasks 4–6 are the application layer:
- Task 4 (store) needs the TypeScript config from Task 2
- Task 5 (layout) needs the store (Task 4) and shadcn components (Task 3)
- Task 6 (open flow) needs the layout shell (Task 5) and Tauri plugins (Task 1)

---

## Tasks

### Task 1: Tauri v2 Project Scaffold

**What:** Create the Tauri v2 + React + TypeScript project using `create-tauri-app`, then configure the Rust side — plugin dependencies, plugin registration, window config, and capabilities.

**Dependencies:** None (first task)

**Estimate:** 3 points

**Files created/modified:**

| File | Action |
|------|--------|
| `src-tauri/Cargo.toml` | Scaffolded, then modified |
| `src-tauri/src/lib.rs` | Scaffolded, then replaced |
| `src-tauri/src/main.rs` | Scaffolded (keep as-is) |
| `src-tauri/build.rs` | Scaffolded (keep as-is) |
| `src-tauri/tauri.conf.json` | Scaffolded, then replaced |
| `src-tauri/capabilities/default.json` | Created |
| `index.html` | Scaffolded (verified in Task 2) |
| `package.json` | Scaffolded (modified in Task 2) |
| All other scaffolded files | Kept as-is for now |

**Implementation:**

**Step 1 — Scaffold the project:**

```bash
pnpm create tauri-app kbzv --template react-ts --manager pnpm
cd kbzv
pnpm install
```

> If scaffolding into an existing directory, run from the parent directory or use `--dir` flag as needed. The scaffold creates the full directory structure including `src-tauri/`, `src/`, `index.html`, `package.json`, `vite.config.ts`, and TypeScript configs.

**Step 2 — Update `src-tauri/Cargo.toml`:**

Replace the `[package]`, `[lib]`, `[dependencies]`, and `[build-dependencies]` sections:

```toml
[package]
name = "kbzv"
version = "0.1.0"
description = "Kanbanzai Viewer"
authors = [""]
edition = "2021"

[lib]
name = "kbzv_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

**Step 3 — Replace `src-tauri/src/lib.rs`:**

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 4 — Verify `src-tauri/src/main.rs` (scaffolded, keep as-is):**

```rust
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    kbzv_lib::run()
}
```

**Step 5 — Verify `src-tauri/build.rs` (scaffolded, keep as-is):**

```rust
fn main() {
    tauri_build::build()
}
```

**Step 6 — Replace `src-tauri/tauri.conf.json`:**

```json
{
  "$schema": "https://raw.githubusercontent.com/nicepage/nicepage-json/master/tauri.conf.json",
  "productName": "KBZV",
  "version": "0.1.0",
  "identifier": "com.kanbanzai.kbzv",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build"
  },
  "app": {
    "windows": [
      {
        "title": "KBZV",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

**Step 7 — Create `src-tauri/capabilities/default.json`:**

```json
{
  "identifier": "default",
  "description": "Default capabilities for KBZV",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:default",
    "dialog:default"
  ]
}
```

**Verification:**

```bash
# 1. Rust compiles
cd src-tauri && cargo check
# Expected: compiles with no errors

# 2. Full app launches
cd .. && pnpm tauri dev
# Expected: a native window opens titled "KBZV" at 1200×800
# The window shows the scaffolded React template content
# The window cannot be resized below 800×600
```

---

### Task 2: Frontend Foundation

**What:** Install all frontend npm dependencies, configure Vite for Tauri (port 1420, path alias, Tailwind plugin), configure TypeScript (path aliases, strict mode), and update `index.html` and `main.tsx` to the spec.

**Dependencies:** Task 1 (Tauri scaffold must exist)

**Estimate:** 3 points

**Files created/modified:**

| File | Action |
|------|--------|
| `package.json` | Modified (add dependencies) |
| `vite.config.ts` | Replaced |
| `tsconfig.json` | Replaced |
| `tsconfig.app.json` | Replaced |
| `tsconfig.node.json` | Replaced |
| `index.html` | Replaced |
| `src/vite-env.d.ts` | Kept (scaffolded) |

**Implementation:**

**Step 1 — Install runtime dependencies:**

```bash
pnpm add react@^18.3.1 react-dom@^18.3.1 zustand@^5.0.3 lucide-react@^0.469.0 \
  @tauri-apps/api@^2.2.0 @tauri-apps/plugin-fs@^2.2.0 @tauri-apps/plugin-dialog@^2.2.0 \
  tailwindcss@^4.0.0 class-variance-authority@^0.7.1 clsx@^2.1.1 tailwind-merge@^3.0.0
```

**Step 2 — Install dev dependencies (if not already scaffolded):**

```bash
pnpm add -D typescript@~5.7.2 vite@^6.1.0 @vitejs/plugin-react@^4.3.4 \
  @types/react@^18.3.18 @types/react-dom@^18.3.5 @tauri-apps/cli@^2.2.0 \
  eslint@^9.17.0 @eslint/js@^9.17.0 typescript-eslint@^8.18.2 \
  eslint-plugin-react-hooks@^5.0.0 eslint-plugin-react-refresh@^0.4.16 \
  globals@^15.14.0 @tailwindcss/vite@^4.0.0
```

> Note: Many of these are already present from the scaffold. `pnpm add` is idempotent — it will update the version range if different. The key additions beyond the scaffold are: `zustand`, `lucide-react`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-dialog`, `tailwindcss@^4`, `@tailwindcss/vite@^4`, `class-variance-authority`, `clsx`, and `tailwind-merge`.

**Step 3 — Replace `vite.config.ts`:**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://v2.tauri.app/start/frontend/vite/
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
```

**Step 4 — Replace `tsconfig.json`:**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

**Step 5 — Replace `tsconfig.app.json`:**

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

**Step 6 — Replace `tsconfig.node.json`:**

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["vite.config.ts"]
}
```

**Step 7 — Replace `index.html`:**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>KBZV</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Verification:**

```bash
# 1. Dependencies resolve
pnpm install
# Expected: no peer dependency warnings for the core stack

# 2. TypeScript compiles
pnpm exec tsc -b --noEmit
# Expected: no type errors

# 3. Vite dev server starts
pnpm dev
# Expected: serves on http://localhost:1420
```

---

### Task 3: Tailwind CSS + shadcn/ui Setup

**What:** Initialise shadcn/ui with the Nova/Mist/Sky theme preset, generate the theme CSS variables in `globals.css`, install all 12 shadcn components needed for F1 and future features, and wire up system dark mode detection.

**Dependencies:** Task 2 (Vite + Tailwind must be configured)

**Estimate:** 3 points

**Files created/modified:**

| File | Action |
|------|--------|
| `components.json` | Generated by `shadcn init` |
| `src/styles/globals.css` | Generated by `shadcn init`, then verified |
| `src/lib/utils.ts` | Generated by `shadcn init` |
| `src/components/ui/button.tsx` | Generated by `shadcn add` |
| `src/components/ui/badge.tsx` | Generated by `shadcn add` |
| `src/components/ui/tabs.tsx` | Generated by `shadcn add` |
| `src/components/ui/collapsible.tsx` | Generated by `shadcn add` |
| `src/components/ui/popover.tsx` | Generated by `shadcn add` |
| `src/components/ui/tooltip.tsx` | Generated by `shadcn add` |
| `src/components/ui/separator.tsx` | Generated by `shadcn add` |
| `src/components/ui/progress.tsx` | Generated by `shadcn add` |
| `src/components/ui/toggle.tsx` | Generated by `shadcn add` |
| `src/components/ui/toggle-group.tsx` | Generated by `shadcn add` |
| `src/components/ui/card.tsx` | Generated by `shadcn add` |
| `src/components/ui/sidebar.tsx` | Generated by `shadcn add` |

**Implementation:**

**Step 1 — Initialise shadcn/ui with the KBZV theme preset:**

```bash
npx shadcn@latest init --preset b7BFemEXi
```

During init, select/confirm these options if prompted:
- **Style:** Nova
- **Base colour:** Mist
- **CSS file:** `src/styles/globals.css`
- **CSS variables:** Yes
- **React Server Components:** No (`rsc: false`)
- **Import alias for components:** `@/components`
- **Import alias for utils:** `@/lib/utils`

This generates three files:
1. `components.json` — shadcn configuration
2. `src/styles/globals.css` — theme CSS variables (light + dark)
3. `src/lib/utils.ts` — the `cn()` utility function

**Step 2 — Verify `components.json`:**

Check that the generated file has these key values:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "nova",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "mist",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

If `style` is not `"nova"`, `rsc` is not `false`, or `tailwind.css` doesn't point to `src/styles/globals.css`, manually correct the file.

**Step 3 — Verify `src/styles/globals.css`:**

The generated file must contain:
- `@import "tailwindcss";` at the top
- `@custom-variant dark (&:is(.dark *));`
- `@theme inline { ... }` block with all CSS variables (light mode defaults)
- `.dark { ... }` block with dark mode overrides
- All required variables: `--background`, `--foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`, `--input`, `--ring`, `--radius`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--sidebar-*`, `--chart-1` through `--chart-5`

If the preset generates different oklch values than the spec, **use the CLI output** — it is authoritative. The spec values are representative. What matters is that every variable name exists in both light and dark blocks.

**Step 4 — Verify `src/lib/utils.ts`:**

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 5 — Install all shadcn components (single batch):**

```bash
npx shadcn@latest add button badge tabs collapsible popover tooltip separator progress toggle toggle-group card sidebar
```

This generates files in `src/components/ui/`. Each file is self-contained — imports from `@/lib/utils` and its own dependencies.

**Step 6 — Verify component files exist:**

```bash
ls src/components/ui/
# Expected: button.tsx badge.tsx tabs.tsx collapsible.tsx popover.tsx
#           tooltip.tsx separator.tsx progress.tsx toggle.tsx
#           toggle-group.tsx card.tsx sidebar.tsx
# (Plus any dependency files like dialog.tsx if sidebar pulls them in)
```

**Step 7 — Wire up dark mode detection in `src/main.tsx`:**

The shadcn/ui `@custom-variant dark` directive uses the `.dark` class on `<html>`. System-follows dark mode requires a small bootstrap script. Update `src/main.tsx` to this exact content:

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

// Sync dark mode with system preference
const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
function applyDarkMode(e: MediaQueryListEvent | MediaQueryList) {
  document.documentElement.classList.toggle("dark", e.matches);
}
applyDarkMode(darkModeMediaQuery);
darkModeMediaQuery.addEventListener("change", applyDarkMode);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 8 — Create a temporary `src/App.tsx` to verify the theme:**

```typescript
import { Button } from "@/components/ui/button";

function App() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Button>Theme Test</Button>
    </div>
  );
}

export default App;
```

**Verification:**

```bash
# 1. All 12+ component files exist
ls src/components/ui/*.tsx | wc -l
# Expected: 12 or more files

# 2. TypeScript compiles with new components
pnpm exec tsc -b --noEmit
# Expected: no type errors

# 3. Theme renders correctly
pnpm tauri dev
# Expected:
#   - Window shows a themed Button (rounded, Sky blue primary colour)
#   - Background uses theme colour (not plain white #fff)
#   - Toggle OS dark mode → app switches to dark theme
#   - Toggle back → app reverts to light theme
```

---

### Task 4: UI Store

**What:** Create the Zustand store for UI state (`projectPath`, `activeView`) with typed actions and exports.

**Dependencies:** Task 2 (TypeScript config, Zustand installed)

**Estimate:** 1 point

**Files created:**

| File | Action |
|------|--------|
| `src/lib/store/ui-store.ts` | Created |

**Implementation:**

**Step 1 — Create the directory structure:**

```bash
mkdir -p src/lib/store
```

**Step 2 — Create `src/lib/store/ui-store.ts`:**

```typescript
import { create } from "zustand";

/**
 * The two top-level views in the app.
 * - 'documents': Document list and viewer (Feature 4)
 * - 'workflows': Entity tree and detail panel (Feature 3)
 */
type ActiveView = "documents" | "workflows";

/**
 * UI state for the application shell.
 * Grows in later features with selectedEntityId, navigationHistory, etc.
 */
interface UIState {
  /** Absolute path to the open Kanbanzai project, or null if none open */
  projectPath: string | null;

  /** Currently active top-level view */
  activeView: ActiveView;

  /** Set the project path. Pass null to close the project. */
  setProjectPath: (path: string | null) => void;

  /** Switch the active top-level view */
  setActiveView: (view: ActiveView) => void;
}

const useUIStore = create<UIState>((set) => ({
  // --- State ---
  projectPath: null,
  activeView: "documents",

  // --- Actions ---
  setProjectPath: (path) => set({ projectPath: path }),
  setActiveView: (view) => set({ activeView: view }),
}));

export { useUIStore };
export type { ActiveView, UIState };
```

**Behavioural contract:**

| Aspect | Specified value |
|--------|----------------|
| Default `projectPath` | `null` (no project open) |
| Default `activeView` | `"documents"` (Docs tab is the landing view) |
| Persistence | None — store resets on app restart |
| Export: `useUIStore` | Named export — the Zustand hook |
| Export: `ActiveView` | Type export — union `"documents" \| "workflows"` |
| Export: `UIState` | Type export — full interface for testing |

**Verification:**

```bash
# 1. TypeScript compiles
pnpm exec tsc -b --noEmit
# Expected: no errors

# 2. Quick smoke test (run in browser console during pnpm tauri dev)
# Type in the webview DevTools console:
#   (after importing in main.tsx temporarily, or via React DevTools)
#   - Store should initialise with projectPath: null, activeView: "documents"
#   - setProjectPath("/some/path") should update projectPath
#   - setActiveView("workflows") should update activeView
```

A more thorough unit test can be added as a stretch goal:

```typescript
// src/lib/store/__tests__/ui-store.test.ts (optional — needs vitest setup)
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
```

---

### Task 5: Layout Shell + View Switcher

**What:** Build the four layout/common components — `AppLayout`, `HeaderBar` (with shadcn Tabs view switcher), `MainPanel`, and `EmptyState` — and wire them together via `App.tsx` and `main.tsx`. After this task, the app shows a themed header bar with working view switcher and contextual empty states.

**Dependencies:** Task 3 (shadcn components available), Task 4 (UI store)

**Estimate:** 5 points

**Files created/modified:**

| File | Action |
|------|--------|
| `src/components/common/EmptyState.tsx` | Created |
| `src/components/layout/AppLayout.tsx` | Created |
| `src/components/layout/HeaderBar.tsx` | Created |
| `src/components/layout/MainPanel.tsx` | Created |
| `src/App.tsx` | Replaced (was temporary test from Task 3) |
| `src/main.tsx` | Verified (should already have dark mode + globals.css from Task 3) |

**Implementation:**

**Step 1 — Create directory structure:**

```bash
mkdir -p src/components/common
mkdir -p src/components/layout
```

**Step 2 — Create `src/components/common/EmptyState.tsx`:**

```typescript
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <Icon className="h-12 w-12 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action && (
          <Button onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
```

**Tailwind class reference:**

| Element | Classes | Renders as |
|---------|---------|-----------|
| Outer container | `flex h-full items-center justify-center` | Full-height centred flex |
| Inner container | `flex flex-col items-center gap-4 text-center` | Vertical stack, 16px gaps |
| Icon | `h-12 w-12 text-muted-foreground` | 48×48px, muted colour |
| Text wrapper | `flex flex-col gap-1` | Title + description, 4px gap |
| Title `<h2>` | `text-lg font-medium` | 18px, weight 500 |
| Description `<p>` | `text-sm text-muted-foreground` | 14px, muted colour |
| Button | (shadcn defaults) | Primary colour, rounded |

**Step 3 — Create `src/components/layout/HeaderBar.tsx`:**

```typescript
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
```

**Header Tailwind class reference:**

| Element | Classes | Purpose |
|---------|---------|---------|
| `<header>` | `flex h-12 shrink-0 items-center justify-between border-b bg-background px-4` | 48px fixed bar, bottom border, content spaced to edges |
| Icon (each) | `h-4 w-4` | 16×16px |
| TabsTrigger | `gap-2` (additional) | 8px gap between icon and label |
| Right placeholder | `flex items-center gap-2 text-sm text-muted-foreground` | Reserves layout space for F6 |

**Step 4 — Create `src/components/layout/MainPanel.tsx`:**

> Note: This version does NOT include the project open flow yet — that's Task 6. It shows a static "No project open" empty state with no action button.

```typescript
import { FileText, FolderOpen, GitBranch } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { useUIStore } from "@/lib/store/ui-store";

function MainPanel() {
  const activeView = useUIStore((s) => s.activeView);
  const projectPath = useUIStore((s) => s.projectPath);

  // No project open — show open prompt (action button added in Task 6)
  if (!projectPath) {
    return (
      <main className="flex-1 overflow-auto">
        <EmptyState
          icon={FolderOpen}
          title="No project open"
          description="Select a Kanbanzai project folder to get started"
        />
      </main>
    );
  }

  // Project open — show view-specific placeholder
  return (
    <main className="flex-1 overflow-auto">
      {activeView === "documents" ? (
        <EmptyState
          icon={FileText}
          title="Documents"
          description="Document list coming in a future update"
        />
      ) : (
        <EmptyState
          icon={GitBranch}
          title="Workflows"
          description="Workflow tree coming in a future update"
        />
      )}
    </main>
  );
}

export { MainPanel };
```

**Step 5 — Create `src/components/layout/AppLayout.tsx`:**

```typescript
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
```

Root `<div>` classes: `flex h-screen flex-col bg-background text-foreground` — full-viewport column layout with theme colours.

**Step 6 — Replace `src/App.tsx`:**

```typescript
import { AppLayout } from "@/components/layout/AppLayout";

function App() {
  return <AppLayout />;
}

export default App;
```

**Step 7 — Verify `src/main.tsx` is correct from Task 3:**

It should already contain the dark mode bootstrap and globals.css import:

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

// Sync dark mode with system preference
const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
function applyDarkMode(e: MediaQueryListEvent | MediaQueryList) {
  document.documentElement.classList.toggle("dark", e.matches);
}
applyDarkMode(darkModeMediaQuery);
darkModeMediaQuery.addEventListener("change", applyDarkMode);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Verification:**

```bash
# 1. TypeScript compiles cleanly
pnpm exec tsc -b --noEmit

# 2. Full app renders the layout
pnpm tauri dev
```

Verify these acceptance criteria manually:

| Check | Expected |
|-------|----------|
| Header bar visible | 48px tall bar with bottom border at top of window |
| Docs tab active | "Docs" tab has primary colour styling with FileText icon |
| Workflows tab visible | "Workflows" tab with GitBranch icon, muted styling |
| Click Workflows | Tab becomes active; content area shows "Workflows" empty state |
| Click Docs | Tab becomes active; content area shows "No project open" (since no project open) |
| Empty state centred | Icon, title, and description vertically and horizontally centred |
| Theme applied | Sky blue primary colour, Nova styling, rounded corners on tabs |
| Dark mode | Toggle OS dark mode; entire UI switches (dark background, light text) |

---

### Task 6: Project Open Flow

**What:** Add the native folder picker, `.kbz/config.yaml` validation, and error dialog to `MainPanel`. This completes the interactive project-open flow — the user clicks "Open Project", selects a folder, and either sees the project accepted or gets an error dialog.

**Dependencies:** Task 5 (layout shell must exist), Task 1 (Tauri plugins registered)

**Estimate:** 3.5 points

**Files modified:**

| File | Action |
|------|--------|
| `src/components/layout/MainPanel.tsx` | Modified (add handleOpenProject + action button) |

**Implementation:**

**Step 1 — Replace `src/components/layout/MainPanel.tsx` with the full version:**

```typescript
import { FileText, FolderOpen, GitBranch } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { useUIStore } from "@/lib/store/ui-store";
import { open } from "@tauri-apps/plugin-dialog";
import { exists } from "@tauri-apps/plugin-fs";
import { message } from "@tauri-apps/plugin-dialog";

async function handleOpenProject(setProjectPath: (path: string | null) => void) {
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

  // 3. Validate: .kbz/config.yaml must exist
  const configPath = `${selected}/.kbz/config.yaml`;
  const isValid = await exists(configPath);

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
      }
    );
  }
}

function MainPanel() {
  const activeView = useUIStore((s) => s.activeView);
  const projectPath = useUIStore((s) => s.projectPath);
  const setProjectPath = useUIStore((s) => s.setProjectPath);

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

  // Project open — show view-specific placeholder
  return (
    <main className="flex-1 overflow-auto">
      {activeView === "documents" ? (
        <EmptyState
          icon={FileText}
          title="Documents"
          description="Document list coming in a future update"
        />
      ) : (
        <EmptyState
          icon={GitBranch}
          title="Workflows"
          description="Workflow tree coming in a future update"
        />
      )}
    </main>
  );
}

export { MainPanel };
```

**`handleOpenProject` flow:**

```
User clicks "Open Project" button
  │
  ├─ open({ directory: true, multiple: false, title: "Open Kanbanzai Project" })
  │     │
  │     ├─ User cancels ──→ return (no action)
  │     │
  │     └─ User selects folder ──→ selected = "/path/to/folder"
  │           │
  │           ├─ exists(`${selected}/.kbz/config.yaml`)
  │           │     │
  │           │     ├─ true ──→ setProjectPath(selected)
  │           │     │            ──→ UI updates to view-specific empty state
  │           │     │
  │           │     └─ false ──→ message("The selected folder...", { kind: "error" })
  │           │                   ──→ Native error dialog shown
  │           │                   ──→ After OK: no state change
```

**Error dialog specification:**

| Property | Exact value |
|----------|-------------|
| API | `message()` from `@tauri-apps/plugin-dialog` |
| Body text | `"The selected folder does not contain a .kbz/config.yaml file. Please select a folder that was initialised with Kanbanzai."` |
| Title | `"Not a Kanbanzai Project"` |
| Kind | `"error"` |
| Button | OK (native, single — dismisses dialog) |
| After dismiss | No state change |

**Edge cases handled:**

| Scenario | Behaviour |
|----------|-----------|
| User cancels folder picker | `open()` returns `null`; early return |
| Folder has `.kbz/` but no `config.yaml` | `exists()` returns `false`; error dialog |
| Same project selected again | `setProjectPath` called with same value; Zustand no-ops |
| New project over existing | `setProjectPath` overwrites; UI updates |
| `exists()` throws (permission error) | Unhandled — surfaces in dev console (acceptable for F1) |
| Path with spaces/special chars | Handled by Tauri's native dialog |

**Verification:**

Run `pnpm tauri dev` and test each scenario:

| Test | Steps | Expected result |
|------|-------|-----------------|
| **AC-3: Folder picker opens** | Click "Open Project" | Native OS folder picker appears with title "Open Kanbanzai Project" |
| **AC-4: Valid project accepted** | Select a folder containing `.kbz/config.yaml` | Empty state changes to "Documents — Document list coming in a future update" |
| **AC-5: Invalid folder rejected** | Select any folder WITHOUT `.kbz/config.yaml` | Native error dialog: "Not a Kanbanzai Project" with message about missing config.yaml. After OK, returns to "No project open" |
| **AC-6: View switcher with project** | Open valid project, switch to Workflows tab | Shows "Workflows — Workflow tree coming in a future update" |
| **Picker cancel** | Click "Open Project", then cancel the folder picker | No change — still shows "No project open" |

**Create a test project folder for verification:**

```bash
# Create a minimal valid Kanbanzai project for testing
mkdir -p /tmp/test-kbz-project/.kbz
echo "project_name: test" > /tmp/test-kbz-project/.kbz/config.yaml

# Also have an invalid folder ready
mkdir -p /tmp/not-a-kbz-project
```

---

## Testing Strategy

### Per-Task Verification

Each task includes inline verification steps. The primary testing method for F1 is **manual verification** via `pnpm tauri dev`:

| Task | Verification method |
|------|-------------------|
| Task 1 | `cargo check` + `pnpm tauri dev` (blank window) |
| Task 2 | `tsc -b --noEmit` + `pnpm dev` (Vite serves) |
| Task 3 | Component files exist + themed button renders + dark mode toggles |
| Task 4 | `tsc -b --noEmit` + optional Vitest unit tests |
| Task 5 | Full layout renders with header, tabs, empty states |
| Task 6 | Folder picker → validation → error dialog / project accepted |

### Optional Unit Tests (Task 4)

The UI store is pure logic and is the best candidate for unit testing in F1. If Vitest is not yet configured, add it:

```bash
pnpm add -D vitest
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

The unit test for `ui-store.ts` is provided in Task 4 above.

### Integration Acceptance Tests

After all tasks are complete, run through every acceptance criterion from the spec:

| AC | Test | Pass criteria |
|----|------|-------------|
| AC-1 | `pnpm tauri dev` | Window opens, titled "KBZV", 1200×800 |
| AC-2 | Visual check | Header bar with Docs/Workflows tabs, bottom border |
| AC-3 | Click "Open Project" | Native folder picker opens |
| AC-4 | Select valid project | Empty state changes to view placeholder |
| AC-5 | Select invalid folder | Error dialog with correct title/message |
| AC-6 | Click Workflows, then Docs | Tab active state + content changes |
| AC-7 | Visual check | Sky blue primary, Nova styling, themed colours |
| AC-8 | Resize window | Minimum 800×600 enforced |
| AC-9 | Toggle OS dark mode | App switches themes |

---

## Risk Areas

### 1. shadcn/ui Preset Availability

**Risk:** The `--preset b7BFemEXi` flag depends on shadcn's hosted theme registry. If the preset URL changes or is unavailable, `shadcn init` may fail or generate a different theme.

**Mitigation:** If the preset is unavailable:
1. Run `npx shadcn@latest init` without the preset flag
2. Choose Nova style, Mist base colour when prompted
3. Manually verify and patch `globals.css` with the CSS variables from the spec §4.2
4. The theme is just CSS custom properties — it's fully hand-editable

### 2. Tailwind CSS 4 Config Model

**Risk:** Tailwind CSS 4 replaces `tailwind.config.ts` with CSS-based configuration (`@theme` directives). Some shadcn components or the init CLI may still expect a JS config file.

**Mitigation:** If `shadcn init` generates a `tailwind.config.ts`, keep it — it won't conflict with the CSS-based config. The `@tailwindcss/vite` plugin handles content detection automatically. Follow whatever the CLI generates and don't manually remove files.

### 3. Tauri v2 Plugin API Surfaces

**Risk:** The `@tauri-apps/plugin-fs` and `@tauri-apps/plugin-dialog` TypeScript APIs may differ slightly from what's shown in the spec (e.g., import paths, function signatures).

**Mitigation:** Pin versions at `^2.2.0`. Check the actual installed package types if compilation fails. The core APIs (`open`, `exists`, `message`) are stable first-party plugins. Adjust import paths if the package structure changes.

### 4. `create-tauri-app` Template Drift

**Risk:** The `create-tauri-app` scaffold may produce different default files than what the spec expects (different Vite config, different tsconfig options, etc.).

**Mitigation:** Tasks 1 and 2 explicitly replace every configuration file with spec-exact content. The scaffold is used only as a starting point for the directory structure and `Cargo.toml` boilerplate.

### 5. Dark Mode Bootstrap Timing

**Risk:** The dark mode detection script in `main.tsx` runs before React hydrates. There's a brief flash-of-wrong-theme possible if the script executes after the first paint.

**Mitigation:** The script runs synchronously at module evaluation time (before `ReactDOM.createRoot`), so the `.dark` class is applied before any React rendering. If a flash is observed, move the script to an inline `<script>` in `index.html` (before the module script) as a fallback.

---

## Summary

| Task | Description | Points | Dependencies |
|------|-------------|--------|-------------|
| 1 | Tauri v2 Project Scaffold | 3 | — |
| 2 | Frontend Foundation | 3 | Task 1 |
| 3 | Tailwind CSS + shadcn/ui Setup | 3 | Task 2 |
| 4 | UI Store | 1 | Task 2 |
| 5 | Layout Shell + View Switcher | 5 | Tasks 3, 4 |
| 6 | Project Open Flow | 3.5 | Tasks 1, 5 |
| | **Total** | **18.5** | |

Critical path: Task 1 → Task 2 → Task 3 → Task 5 → Task 6 (17.5 points)

Task 4 can run in parallel with Task 3 (both depend on Task 2), but since both are needed for Task 5, the parallelism saves at most the duration of Task 4 (1 point).
