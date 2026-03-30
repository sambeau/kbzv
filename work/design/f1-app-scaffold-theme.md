# Feature 1: App Scaffold + Theme — Design Document

**Feature:** FEAT-01KMZA96W1J98 (`app-scaffold-theme`)
**Parent Plan:** P1-kbzv
**Status:** Proposed
**Architecture Reference:** [KBZV Architecture Design](kbzv-architecture.md)

---

## 1. Overview

This feature delivers the foundational running application: a Tauri v2 desktop window with a React/TypeScript frontend, the shadcn/ui theme applied (Nova style, Mist base, Sky theme), a two-view layout shell, and a native project-open dialog. Everything else in KBZV builds on this scaffold.

After this feature is complete, `pnpm tauri dev` launches a styled desktop window. The user can open a Kanbanzai project folder, switch between two empty views (Documents and Workflows), and see the themed UI with correct colours, typography, and spacing. No data loading or content rendering is included.

### What This Feature Delivers

- A running Tauri v2 desktop app (macOS, future Windows/Linux)
- React 18 + TypeScript + Vite frontend scaffold
- Tailwind CSS 4 + shadcn/ui component library with the KBZV theme
- Header bar with view switcher and placeholder git info area
- Native folder picker for opening Kanbanzai projects
- Project path validation (`.kbz/config.yaml` must exist)
- Empty states for both views
- Minimal Zustand store (`projectPath`, `activeView`)

### What This Feature Does Not Deliver

- No YAML parsing, no entity loading, no data layer
- No actual content in Documents or Workflows views
- No Markdown rendering
- No file watching
- No git status reading

---

## 2. Technology Stack (Feature 1 Subset)

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| App shell | Tauri v2 | 2.x | Native desktop container |
| Frontend framework | React | 18.x | UI rendering |
| Language | TypeScript | 5.x | Type safety |
| Bundler | Vite | 6.x | HMR, fast builds |
| Styling | Tailwind CSS | 4.x | Utility-first CSS |
| Components | shadcn/ui | latest | Nova/Mist/Sky themed components |
| State | Zustand | 5.x | Lightweight store |
| Icons | Lucide React | latest | Icon library (bundled with shadcn) |
| File access | @tauri-apps/plugin-fs | 2.x | FS permissions for validation |
| Dialogs | @tauri-apps/plugin-dialog | 2.x | Native folder picker |
| Package manager | pnpm | 9.x | Fast, disk-efficient |
| Rust toolchain | stable | latest | Tauri compilation |
| Node.js | 20+ | LTS | Frontend build |

---

## 3. Project Structure (Feature 1 Files)

Only the files created or modified in Feature 1 are listed. The full project structure is defined in the architecture document §3.3.

```
kbzv/
├── src-tauri/                        # Rust (Tauri scaffold)
│   ├── src/
│   │   └── lib.rs                    # Minimal app setup — plugin registration
│   ├── Cargo.toml                    # Tauri + plugin dependencies
│   ├── tauri.conf.json               # Window config, app metadata, permissions
│   └── capabilities/
│       └── default.json              # FS read + dialog permissions
│
├── src/                              # TypeScript/React frontend
│   ├── main.tsx                      # React DOM entry point
│   ├── App.tsx                       # Root component — layout + routing
│   │
│   ├── lib/
│   │   └── store/
│   │       └── ui-store.ts           # Zustand store: projectPath, activeView
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx         # Header bar + view area container
│   │   │   ├── HeaderBar.tsx         # View switcher (left) + git info placeholder (right)
│   │   │   └── MainPanel.tsx         # Active view container
│   │   │
│   │   └── common/
│   │       └── EmptyState.tsx        # "No project open" / "No content" placeholder
│   │
│   └── styles/
│       └── globals.css               # Tailwind imports + shadcn theme CSS variables
│
├── index.html                        # Vite HTML entry
├── package.json                      # Dependencies, scripts
├── tsconfig.json                     # TypeScript configuration
├── tsconfig.app.json                 # App-specific TS config
├── tsconfig.node.json                # Node/Vite TS config
├── vite.config.ts                    # Vite configuration for Tauri
├── tailwind.config.ts                # Tailwind CSS 4 configuration
├── components.json                   # shadcn/ui configuration
└── eslint.config.js                  # Linting
```

### Files Deferred to Later Features

These files appear in the architecture §3.3 but are **not** created in Feature 1:

- `lib/types/` — all entity type definitions (Feature 2)
- `lib/store/project-store.ts` — full entity store (Feature 2)
- `lib/reader/` — YAML loading, file watching (Features 2, 6)
- `lib/query/` — tree building, metrics, references (Feature 2)
- `lib/constants/` — status colours, entity metadata (Feature 2)
- `components/tree/` — entity tree (Feature 3)
- `components/entity/` — entity detail panels (Feature 3)
- `components/document/` — Markdown viewer (Feature 4)
- `components/metrics/` — progress bars, estimates (Feature 3)
- `components/common/StatusBadge.tsx` — coloured status pill (Feature 2)
- `components/common/EntityLink.tsx` — clickable references (Feature 5)
- `components/common/LoadingState.tsx` — loading spinner (Feature 2)
- `components/layout/Sidebar.tsx` — entity sidebar (Feature 3)

---

## 4. Tauri v2 Rust Scaffold

The Rust side is intentionally minimal. Tauri v2 handles windowing, native menus, and the webview. The Rust code registers plugins and configures the app — nothing more.

### 4.1 `src-tauri/Cargo.toml`

Key dependencies:

| Crate | Purpose |
|-------|---------|
| `tauri` 2.x | App framework |
| `tauri-plugin-fs` | File system access (read `.kbz/config.yaml` for validation) |
| `tauri-plugin-dialog` | Native folder picker |

Feature 1 does **not** need `tauri-plugin-shell` (that's for opening external links, deferred).

### 4.2 `src-tauri/src/lib.rs`

Minimal Tauri app setup:

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

No custom Rust commands are needed in Feature 1. All logic runs in the TypeScript frontend using the Tauri plugin APIs.

### 4.3 `src-tauri/tauri.conf.json`

Key configuration:

```json
{
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
    ]
  }
}
```

Window dimensions: **1200×800** default, **800×600** minimum. This gives adequate space for the two-view layout. The app is resizable but not fullscreenable by default.

### 4.4 Capabilities (`capabilities/default.json`)

Tauri v2 uses a capabilities system for permissions. Feature 1 needs:

- **`fs:default`** — read access for validating `.kbz/config.yaml` existence
- **`dialog:default`** — native folder picker dialog
- **Scope:** the user-selected project directory (set dynamically after folder selection)

The capability file grants the frontend permission to use these plugins. Example structure:

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

Additional scoped FS permissions (for reading `.kbz/state/` contents) will be refined in Feature 2 when the data layer reads entity files.

---

## 5. Frontend Scaffold

### 5.1 Entry Point (`main.tsx`)

Standard React 18 entry point rendering `<App />` into the `#root` element in `index.html`. Strict mode enabled.

### 5.2 Root Component (`App.tsx`)

The root component composes the layout:

```
<App>
  └── <AppLayout>
        ├── <HeaderBar>
        │     ├── view switcher (left)
        │     └── git info placeholder (right)
        └── <MainPanel>
              └── (active view — EmptyState for now)
```

`App.tsx` reads `activeView` and `projectPath` from the Zustand `ui-store` and passes them down. It also provides the project-open callback to the empty state component.

### 5.3 Vite Configuration (`vite.config.ts`)

Standard Vite config for Tauri:

- React plugin (`@vitejs/plugin-react`)
- Dev server on port `1420` (Tauri convention)
- Clear screen disabled (Tauri manages the terminal)
- Source maps enabled in development

### 5.4 TypeScript Configuration

Three-file setup following Vite + Tauri conventions:

- `tsconfig.json` — project references to `tsconfig.app.json` and `tsconfig.node.json`
- `tsconfig.app.json` — app code (`src/`), strict mode, React JSX
- `tsconfig.node.json` — build tooling (`vite.config.ts`)

---

## 6. shadcn/ui Theme Configuration

### 6.1 Theme Settings

| Setting | Value |
|---------|-------|
| Style | Nova |
| Base Colour | Mist |
| Theme | Sky |
| Preset | `--preset b7BFemEXi` |

The theme is initialised using the shadcn CLI with the preset flag, which generates the full CSS variable palette in `globals.css`. All components inherit from these variables — no ad-hoc colour overrides.

### 6.2 Core Components to Install (Feature 1)

These components are installed via `npx shadcn@latest add`:

| Component | F1 Usage |
|-----------|----------|
| **Button** | Open project button, view switcher buttons |
| **Badge** | Placeholder for future status lozenges |
| **Tabs** | View switcher (Documents / Workflows) |
| **Collapsible** | Placeholder for future expandable sections |
| **Popover** | Placeholder for future overflow info |
| **Tooltip** | Header bar tooltips |
| **Separator** | Visual dividers in header |
| **Progress** | Placeholder for future progress bars |
| **Toggle** | Placeholder for future filter toggles |
| **ToggleGroup** | Placeholder for future grouped filters |
| **Card** | Empty state container styling |
| **Sidebar** | Installed now for future use in Feature 3 |

Components marked "placeholder" are installed to establish the theme and avoid re-running the CLI later. They carry no bundle cost until imported.

### 6.3 `globals.css` Structure

```css
@import "tailwindcss";

/* shadcn/ui theme CSS custom properties generated by --preset b7BFemEXi */
/* Includes :root (light) and .dark (dark) variable sets */
/* Covers: --background, --foreground, --card, --popover, --primary, */
/*         --secondary, --muted, --accent, --destructive, --border, */
/*         --input, --ring, --sidebar-*, --chart-*, --radius, etc. */
```

The preset generates all CSS variables for both light and dark modes. Feature 1 ships with system-follows colour scheme (`prefers-color-scheme` media query). Manual theme toggle is deferred.

### 6.4 Design Fundamentals Applied in Feature 1

From architecture §6.1, the following principles are active even in the scaffold:

- **Minimum info for the size** — the header bar shows only the view switcher and git info area; no extraneous chrome
- **Clickability is visible** — the view switcher buttons and "Open" button use `cursor: pointer`; interactive elements have hover/active states from the shadcn theme
- **Typography adds info** — the empty state uses lighter, secondary-coloured text to indicate it's a placeholder, not an error
- **Colour carries meaning** — the active view tab uses the primary accent colour; inactive tab uses muted styling

---

## 7. Layout Design

### 7.1 Two-View Model

The app has two top-level views — **Documents** and **Workflows** — switched via the header bar. Each view occupies the full window area below the header. There is no persistent sidebar in Feature 1.

```
┌──────────────────────────────────────────────────────────────────────┐
│  [FileText] Docs   [GitBranch] Workflows          [git info area]   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                                                                      │
│                    (active view fills this space)                     │
│                                                                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.2 Header Bar (`HeaderBar.tsx`)

A single thin bar spanning the window width. Fixed height (~48px). Contains two areas:

**Left: View Switcher**

- Two buttons, each with a Lucide icon and text label
- **Documents** — `FileText` icon + "Docs" label
- **Workflows** — `GitBranch` icon + "Workflows" label
- Active view button: primary colour, filled style
- Inactive view button: muted colour, ghost style
- Clicking a button sets `activeView` in the ui-store
- Implementation: shadcn `Tabs` component or custom button group using `ToggleGroup`

**Right: Git Info Placeholder**

- A right-aligned area reserved for Feature 6's git status display
- In Feature 1: shows muted placeholder text or is empty
- Layout reserves the space so Feature 6 doesn't require layout changes
- Approximate format (once populated): `GitBranch repo / branch    N changes    ↑ N | ↓ N`

### 7.3 Main Panel (`MainPanel.tsx`)

The area below the header. Fills all remaining vertical space (`flex-1` or `h-[calc(100vh-48px)]`). Renders the active view component.

In Feature 1, both views render the same `EmptyState` component with contextual messaging:

- **No project open:** "No project open — click Open to select a Kanbanzai project folder"
- **Project open, Documents view:** "Documents view — coming soon" (or minimal placeholder)
- **Project open, Workflows view:** "Workflows view — coming soon" (or minimal placeholder)

### 7.4 Empty State (`EmptyState.tsx`)

A reusable component for when there's nothing to display. Design:

- Centered vertically and horizontally in its container
- Icon (contextual — `FolderOpen` for no project, `FileText` for empty docs, `GitBranch` for empty workflows)
- Primary text: brief description of the state
- Secondary text: hint at the action to take (lighter colour, smaller size)
- Optional action button (e.g., "Open Project" button when no project is open)
- Uses `text-muted-foreground` for the secondary text (from the theme)

Props:

```typescript
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

---

## 8. Project Open Flow

### 8.1 Trigger

The "Open Project" action is available via:

- The `EmptyState` action button ("Open Project") when no project is loaded
- A future menu item (File → Open — deferred, not in Feature 1 scope)

### 8.2 Flow

```
User clicks "Open Project"
  │
  ▼
Native folder picker opens
(@tauri-apps/plugin-dialog → open({ directory: true }))
  │
  ├── User cancels → no action
  │
  └── User selects a folder
        │
        ▼
  Validate: does <selectedPath>/.kbz/config.yaml exist?
  (@tauri-apps/plugin-fs → exists() or stat())
        │
        ├── YES → store projectPath in ui-store
        │         → update empty states to "view coming soon"
        │
        └── NO → show error dialog
                  (@tauri-apps/plugin-dialog → message())
                  "Not a Kanbanzai project — .kbz/config.yaml not found"
                  → return to previous state (no projectPath change)
```

### 8.3 Validation Details

The validation check is simple existence-based:

1. Construct path: `${selectedFolder}/.kbz/config.yaml`
2. Use `@tauri-apps/plugin-fs` to check if the file exists
3. **Do not parse** the YAML — that's Feature 2's responsibility
4. If the file exists, the folder is considered a valid Kanbanzai project

This intentionally does not validate the config's contents. A project with a malformed `config.yaml` is still "openable" — the data layer (Feature 2) will handle parse errors with appropriate UI feedback.

### 8.4 Error Dialog

When validation fails, use the Tauri dialog plugin to show a native error dialog:

- **Type:** Error / message dialog (native OS style)
- **Title:** "Not a Kanbanzai Project"
- **Message:** "The selected folder does not contain a `.kbz/config.yaml` file. Please select a folder that was initialised with Kanbanzai."
- **Button:** OK (dismisses the dialog)

This uses `@tauri-apps/plugin-dialog`'s `message()` function with `kind: 'error'`.

---

## 9. State Management

### 9.1 UI Store (`ui-store.ts`)

Feature 1 introduces a minimal Zustand store. This store grows in later features but starts small.

```typescript
import { create } from 'zustand';

type ActiveView = 'documents' | 'workflows';

interface UIState {
  // State
  projectPath: string | null;
  activeView: ActiveView;

  // Actions
  setProjectPath: (path: string | null) => void;
  setActiveView: (view: ActiveView) => void;
}

const useUIStore = create<UIState>((set) => ({
  projectPath: null,
  activeView: 'documents',

  setProjectPath: (path) => set({ projectPath: path }),
  setActiveView: (view) => set({ activeView: view }),
}));

export { useUIStore };
export type { ActiveView, UIState };
```

Notes:

- `activeView` defaults to `'documents'` — the Documents view is the landing tab
- `projectPath` is `null` until the user opens a project
- No persistence — the store resets on app restart (project must be re-opened)
- The full `ProjectState` store from architecture §4.3 is created in Feature 2 as a separate `project-store.ts`

### 9.2 Store Separation

The architecture defines two stores that evolve over the feature sequence:

| Store | Feature 1 | Feature 2+ |
|-------|-----------|------------|
| `ui-store.ts` | `projectPath`, `activeView` | + `selectedEntityId`, `navigationHistory`, `expandedNodes`, etc. |
| `project-store.ts` | Not created | Entity maps, config, tree, derived state |

This separation keeps UI concerns (which view is active, what's selected) apart from data concerns (parsed entities, computed metrics). Both stores are Zustand — lightweight and independently subscribable.

---

## 10. Component Specifications

### 10.1 `AppLayout.tsx`

The top-level layout component. Provides the structural frame.

**Structure:**
- Full viewport height (`h-screen`)
- Flex column layout (`flex flex-col`)
- Contains `<HeaderBar />` (fixed height) and `<MainPanel />` (flex-1)
- Applies the base background colour from the theme (`bg-background`)

### 10.2 `HeaderBar.tsx`

**Structure:**
- Fixed height bar (~48px, `h-12`)
- Flex row with `justify-between`
- Left section: view switcher
- Right section: git info placeholder
- Bottom border (`border-b`) for visual separation from content area
- Background: `bg-background` or `bg-card` (subtle contrast)

**View Switcher Implementation:**

Option A — shadcn `Tabs`:

```tsx
<Tabs value={activeView} onValueChange={setActiveView}>
  <TabsList>
    <TabsTrigger value="documents">
      <FileText className="h-4 w-4 mr-2" />
      Docs
    </TabsTrigger>
    <TabsTrigger value="workflows">
      <GitBranch className="h-4 w-4 mr-2" />
      Workflows
    </TabsTrigger>
  </TabsList>
</Tabs>
```

Option B — custom `ToggleGroup`:

```tsx
<ToggleGroup type="single" value={activeView} onValueChange={setActiveView}>
  <ToggleGroupItem value="documents">
    <FileText className="h-4 w-4 mr-2" />
    Docs
  </ToggleGroupItem>
  <ToggleGroupItem value="workflows">
    <GitBranch className="h-4 w-4 mr-2" />
    Workflows
  </ToggleGroupItem>
</ToggleGroup>
```

**Recommendation:** Use `Tabs` (Option A). It provides built-in active state styling, keyboard navigation, and the conceptual model matches — we're switching between two views. The `TabsContent` can be omitted (or placed in `MainPanel`) since the content area is separate from the header.

### 10.3 `MainPanel.tsx`

**Structure:**
- Fills remaining height (`flex-1`, `overflow-auto`)
- Renders the active view based on `activeView` from the store
- In Feature 1, both views render `<EmptyState />` with appropriate props

**Conditional rendering:**

```tsx
function MainPanel() {
  const { activeView, projectPath } = useUIStore();

  if (!projectPath) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No project open"
        description="Select a Kanbanzai project folder to get started"
        action={{ label: "Open Project", onClick: handleOpenProject }}
      />
    );
  }

  switch (activeView) {
    case 'documents':
      return (
        <EmptyState
          icon={FileText}
          title="Documents"
          description="Document list coming in a future update"
        />
      );
    case 'workflows':
      return (
        <EmptyState
          icon={GitBranch}
          title="Workflows"
          description="Workflow tree coming in a future update"
        />
      );
  }
}
```

### 10.4 `EmptyState.tsx`

**Structure:**
- Centered container (`flex items-center justify-center h-full`)
- Stacked vertically: icon → title → description → optional action button
- Icon: 48×48px, `text-muted-foreground` colour
- Title: `text-lg font-medium`
- Description: `text-sm text-muted-foreground`
- Action button: shadcn `Button` component, default variant

---

## 11. Dependency Installation Sequence

### 11.1 Tauri + Rust Setup

1. `pnpm create tauri-app kbzv --template react-ts` (or `npm create tauri-app`)
2. This scaffolds `src-tauri/` with `Cargo.toml`, `tauri.conf.json`, and `lib.rs`
3. Add plugins to `Cargo.toml`:
   - `tauri-plugin-fs`
   - `tauri-plugin-dialog`
4. Register plugins in `lib.rs`

### 11.2 Frontend Dependencies

```bash
# Tauri frontend plugins
pnpm add @tauri-apps/plugin-fs @tauri-apps/plugin-dialog

# State management
pnpm add zustand

# Icons (may already be installed via shadcn)
pnpm add lucide-react
```

### 11.3 shadcn/ui Setup

```bash
# Initialise shadcn with the KBZV theme preset
npx shadcn@latest init --preset b7BFemEXi

# Install core components for Feature 1
npx shadcn@latest add button badge tabs collapsible popover tooltip separator progress toggle toggle-group card sidebar
```

The `init` command configures `components.json`, generates `globals.css` with theme variables, and sets up the `@/components/ui` import alias.

---

## 12. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `pnpm tauri dev` launches a desktop window | Manual: window appears with title "KBZV" |
| AC-2 | Header bar displays view switcher with Docs and Workflows tabs | Manual: both tabs visible with icons |
| AC-3 | Clicking "Open" triggers a native folder picker | Manual: OS folder picker dialog appears |
| AC-4 | Selecting a valid Kanbanzai project stores the path | Manual: empty state changes from "No project open" to view placeholder |
| AC-5 | Selecting an invalid folder shows a native error dialog | Manual: error dialog with "Not a Kanbanzai Project" message |
| AC-6 | View switcher toggles between Documents and Workflows | Manual: clicking each tab shows the corresponding empty state |
| AC-7 | shadcn theme is visibly applied — correct colours, typography, spacing | Manual: Nova/Mist/Sky theme variables active, components styled correctly |
| AC-8 | Window is resizable with 800×600 minimum | Manual: resize the window, verify minimum enforced |
| AC-9 | Both light and dark modes work (system-follows) | Manual: toggle OS appearance, verify theme responds |

---

## 13. Risks and Decisions

### 13.1 Tauri v2 Plugin Compatibility

**Risk:** Tauri v2 is relatively new; plugin APIs may have breaking changes.
**Mitigation:** Pin exact versions in `Cargo.toml` and `package.json`. The plugins needed (FS, dialog) are first-party and stable.

### 13.2 shadcn/ui Preset Availability

**Risk:** The `--preset b7BFemEXi` flag depends on shadcn's theme registry.
**Mitigation:** If the preset is unavailable, manually configure the CSS variables for Nova/Mist/Sky. The theme is CSS custom properties — portable and hand-editable.

### 13.3 Tailwind CSS 4

**Risk:** Tailwind CSS 4 changes the configuration model (CSS-based config vs. `tailwind.config.ts`).
**Mitigation:** Follow Tauri's recommended template configuration. shadcn/ui's init handles Tailwind integration.

### 13.4 View Switcher Component Choice

**Decision:** Use shadcn `Tabs` for the view switcher (see §10.2, Option A).
**Rationale:** Tabs semantically match the two-view model, provide keyboard navigation, and have built-in active state styling. `ToggleGroup` is an acceptable alternative if Tabs styling doesn't fit the header bar design.

---

## 14. Open Items

1. **Menu bar** — should Feature 1 include a basic macOS menu bar with File → Open, or is the empty state button sufficient? _Recommendation: defer menu bar to a later feature; the empty state button is enough for now._

2. **Window title** — should the title bar show the project name after opening? E.g., "KBZV — my-project". _Recommendation: yes, update the window title via Tauri's `window.setTitle()` when a project is opened. Low effort, high clarity._

3. **Remember last project** — should the app remember and re-open the last project on launch? _Recommendation: defer to a future feature. Requires persistent storage (Tauri's app data directory). Feature 1 always starts with no project open._

---

## References

- [KBZV Architecture Design](kbzv-architecture.md) — §2 (tech stack), §3.3 (project structure), §6.1–6.3 (UI design), §8 (error handling), §10 (dependencies)
- [KBZV v1.0 Development Plan](../plan/kbzv-v1-dev-plan.md) — Feature 1 scope, acceptance criteria, implementation notes
- [Tauri v2 Documentation](https://v2.tauri.app) — plugin APIs, capabilities system
- [shadcn/ui Documentation](https://ui.shadcn.com) — component library, theming