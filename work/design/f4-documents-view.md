# Feature 4: Documents View — Design Document

| Field       | Value                                      |
|-------------|--------------------------------------------|
| Feature ID  | FEAT-01KMZA9JMZFNF                        |
| Parent Plan | P1-kbzv                                    |
| Depends On  | FEAT-01KMZA96W1J98 (F1), FEAT-01KMZA9CP9XEX (F2) |
| Status      | Draft                                      |

---

## 1. Purpose

Feature 4 delivers the **Documents view** — one of the two top-level views in KBZV. It provides a filterable list of all project documents and a Markdown viewer for reading individual documents with full metadata and drift detection.

Users open this view to browse design docs, specifications, research notes, and other registered documents without leaving the desktop app. The view emphasises beautiful Markdown rendering, at-a-glance document status, and content-hash drift detection that warns when an approved document has been modified on disk since approval.

### 1.1 What Ships

- A **Document List** screen showing every registered document with title, type, status, and date
- A **Filter Bar** with type and status toggle filters, plus a sort control
- A **Document Viewer** screen with paper-width GFM Markdown rendering and a metadata sidebar
- **Drift detection** comparing on-disk content against the document record's stored SHA-256 hash
- A **DriftBadge** component with four visual states
- A `document.ts` reader module for loading Markdown files and computing content hashes

### 1.2 What Does Not Ship (Out of Scope)

| Deferred to | Capability |
|-------------|------------|
| F5 (Cross-View Navigation) | EntityLink navigation from metadata panel (Owner, Related Entities, Superseded By links navigate to Workflows view) |
| F6 (File Watching) | Live reload when documents change on disk |

EntityLink components will be rendered in the metadata panel but will be inert until F5 wires up cross-view navigation.

---

## 2. Data Model

### 2.1 DocumentRecord (from `.kbz/state/documents/`)

The Documents view reads from the `documents` map in the Zustand `ProjectState` store. Each entry is a `DocumentRecord` parsed from YAML:

```
interface DocumentRecord {
  id: string;              // {owner}/{type}-{slug} or PROJECT/{type}-{slug}
  path: string;            // relative to repo root (e.g. "work/design/kbzv-arch.md")
  type: string;            // design | specification | dev-plan | research | report | policy | rca
  title: string;           // human-readable title — the PROMINENT display name
  status: string;          // draft | approved | superseded
  owner?: string;          // Plan or Feature ID
  approved_by?: string;
  approved_at?: string;
  content_hash?: string;   // SHA-256 of file content at approval time
  supersedes?: string;     // document record ID
  superseded_by?: string;  // document record ID
  created: string;         // ISO 8601
  created_by: string;
  updated: string;         // ISO 8601
}
```

### 2.2 Key Data Invariants

- `title` is always present and is the **primary display name** — never fall back to the filename in prominent positions.
- `path` is relative to the project root. The full path for file reading is `{projectPath}/{documentRecord.path}`.
- `content_hash` may be absent (pre-approval documents, or older records). Treat absent hash as "no drift data available".
- `type` may contain values unknown to the viewer (forward compatibility). Unknown types render with a neutral colour and the raw string.
- `status` may contain unknown values. Unknown statuses render as grey with the raw string.

---

## 3. Document List

### 3.1 Layout

```
┌─[Docs]─[Workflows]───────────────────────────[git info]─┐
│                                                           │
│  [type filters]  [status filters]       [sort: newest ▼] │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Architecture Design               design  approved  │ │
│  │ 3 days ago                                          │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ Initial Proposal                    plan    draft   │ │
│  │ 5 days ago                                          │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │ Sprint Retrospective              report  approved  │ │
│  │ 1 week ago                                          │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### 3.2 List Row Anatomy

Each document row is a single clickable card-like element containing:

| Element | Position | Typography | Details |
|---------|----------|------------|---------|
| **Title** | Left, top line | Prominent weight, standard size | `documentRecord.title` — never the filename |
| **Date modified** | Left, second line | Small, grey (`text-muted-foreground`) | Relative time (e.g. "3 days ago") with full ISO date in a `Tooltip` on hover. Derived from `documentRecord.updated`. |
| **Type lozenge** | Right, top line | `Badge` component | Distinct colour per type (see §3.5) |
| **Status lozenge** | Right, top line (after type) | `Badge` component | Colour per status (see §3.4) |

The entire row has `cursor: pointer`. Clicking anywhere on the row navigates to the Document Viewer for that document.

### 3.3 Empty State

When the document list is empty (no documents at all, or all filtered out):

- **No documents registered**: Show `EmptyState` component — icon (FileText), heading "No documents", body "This project has no registered documents."
- **All filtered out**: Show `EmptyState` — icon (Filter), heading "No matches", body "No documents match the active filters." with a "Clear filters" link.

### 3.4 Status Colours

From the architecture's prescribed status colour palette (§6.5):

| Status | Colour | Hex | Badge Variant |
|--------|--------|-----|---------------|
| `draft` | Grey | `#9CA3AF` | `secondary` or custom grey |
| `approved` | Green | `#22C55E` | `default` with green background |
| `superseded` | Purple | `#A855F7` | `default` with purple background |
| Unknown | Grey | `#9CA3AF` | `outline` with raw string |

### 3.5 Type Colours

Each document type gets a distinct muted colour to differentiate at a glance. These are independent of the status palette:

| Type | Suggested Colour |
|------|-----------------|
| `design` | Blue |
| `specification` | Teal |
| `dev-plan` | Indigo |
| `research` | Amber |
| `report` | Slate |
| `policy` | Rose |
| `rca` | Orange |
| Unknown | Grey (raw string displayed) |

Exact hex values should be drawn from the Tailwind/shadcn palette to match the Mist/Sky theme.

### 3.5 Default Sort and Sort Control

- **Default sort**: `updated` field, newest first (descending).
- **Sort control**: A dropdown (shadcn `Select` or `DropdownMenu`) in the filter bar, right-aligned, with options:
  - Newest first (default)
  - Oldest first
  - Title A–Z
  - Title Z–A
  - Type
  - Status
- Sort is stable — items with equal sort keys retain their relative order.

### 3.6 Filter Bar

The filter bar sits above the document list and below the app header.

**Type filters**: A `ToggleGroup` with one `Toggle` button per known document type (design, specification, dev-plan, research, report, policy). Each button shows the type name. Multiple can be active simultaneously.

**Status filters**: A separate `ToggleGroup` with three `Toggle` buttons: Approved (green indicator), Draft (grey indicator), Superseded (purple indicator).

**Filter logic**:
- **AND across categories**: If "design" type and "approved" status are both active, only documents matching both are shown.
- **OR within a category**: If "design" and "report" types are both active, documents of either type are shown (provided they also match any active status filter).
- **No active filters = show all**: When no toggles are active in a category, that category imposes no restriction.

**Lozenge-as-filter shortcut**: Clicking a type or status lozenge in a list row activates that value as a filter toggle. If already active, it deactivates. This provides a quick drill-down without reaching for the filter bar.

**Active filter indicators**: Active toggles use the standard `ToggleGroup` pressed state (visually distinct background). No separate "active filter lozenges" are needed since the toggles themselves show state.

### 3.7 No Pagination

All documents load into memory at once (data is local and small — typically <100 documents). The list renders all matching documents. Virtual scrolling may be added later if performance requires it, but is not part of F4.

---

## 4. Document Viewer

### 4.1 Layout

The viewer uses the **sidebar-15 pattern** (content area + right sidebar):

```
┌─[Docs]─[Workflows]───────────────────────────[git info]─┐
│                                                           │
│  [← Back]  Architecture Design                           │
│                                                           │
│  ┌──────────────────────────┐  ┌───────────────────────┐ │
│  │                          │  │ Status                │ │
│  │  (markdown content)      │  │ [approved badge]      │ │
│  │                          │  │                       │ │
│  │  rendered at             │  │ Filename              │ │
│  │  paper width             │  │ work/design/arch.md   │ │
│  │  (~700px max)            │  │                       │ │
│  │                          │  │ Type                  │ │
│  │  github-flavoured        │  │ [design badge]        │ │
│  │  markdown theme          │  │                       │ │
│  │                          │  │ Owner                 │ │
│  │                          │  │ P1-kbzv               │ │
│  │                          │  │                       │ │
│  │                          │  │ Related Entities      │ │
│  │                          │  │ FEAT-001 init-cmd     │ │
│  │                          │  │ FEAT-002 viewer       │ │
│  │                          │  │                       │ │
│  │                          │  │ Superseded By         │ │
│  │                          │  │ (none)                │ │
│  │                          │  │                       │ │
│  │                          │  │ Content Hash          │ │
│  │                          │  │ ✓ matches (small/grey)│ │
│  └──────────────────────────┘  └───────────────────────┘ │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### 4.2 Viewer Header

- **Back button**: `Button` with `variant="ghost"` + `ChevronLeft` icon from Lucide. Label text: "Back" (or icon-only with tooltip).
- **Document title**: Displayed prominently next to the back button. Uses `documentRecord.title`.
- Clicking the back button returns to the Document List.

### 4.3 Back Button Behaviour

The back button **preserves the list state**:
- Scroll position within the document list
- Active filter toggles (both type and status)
- Current sort selection

Implementation: The Documents view maintains its navigation state internally (list vs. viewer) via local component state or the UI store. When navigating back, the list component remounts with its previous filter/sort/scroll state intact. The simplest approach is to keep the `DocumentList` component mounted but hidden (via CSS `display: none` or conditional rendering that preserves state via a key-stable wrapper).

### 4.4 Content Area (Left)

The left side of the viewer displays the rendered Markdown content. See §5 for full Markdown rendering details.

- **Width**: `max-width: 700px` (paper-width column for comfortable reading)
- **Alignment**: Left-aligned within its available space, with appropriate padding
- **Scroll**: The content area scrolls independently if the document exceeds the viewport height
- **Missing file**: If the Markdown file at `documentRecord.path` does not exist on disk, display an inline message: icon (FileX from Lucide) + "File not found" heading + "The file `{path}` could not be found." as body text. Use the `EmptyState` component pattern.

### 4.5 Metadata Panel (Right Sidebar)

A fixed-width sidebar (~250px) on the right side displaying document metadata. The panel does not scroll with the content — it remains visible as the user reads the document (or scrolls independently if its own content overflows).

#### Metadata Fields (top to bottom)

**1. Status (prominent, top position)**

The most important metadata item. Rendered using the `DriftBadge` component (§6), which combines the document's `status` field with drift detection results.

Four visual states:
| Condition | Badge |
|-----------|-------|
| `status === "approved"` AND content hash matches | Green badge: **"Approved"** |
| `status === "approved"` AND content hash differs (or hash missing) | Orange badge: **"Modified since approval"** |
| `status === "draft"` | Grey badge: **"Draft"** |
| `status === "superseded"` | Purple badge: **"Superseded"** |

For unknown status values: grey badge with the raw status string.

**2. Filename**

The actual file path (`documentRecord.path`), displayed in small grey text (`text-muted-foreground`, `text-sm`). This is the secondary identifier — the title is already shown in the viewer header.

**3. Type**

The document type rendered as a coloured `Badge` (same lozenge style as the list view, using the type colour palette from §3.5).

**4. Owner**

The parent plan or feature ID (`documentRecord.owner`). Rendered as an `EntityLink` component. In F4, the link is rendered but navigation is inert — clicking does nothing visible. F5 will wire this to navigate to the Workflows view.

If `owner` is absent: display "(none)" in grey text.

**5. Related Entities**

Entities that reference this document. This requires a reverse lookup: scan entity fields (particularly `design` fields on features/plans) for references to this document's ID.

Each related entity is rendered as an `EntityLink` showing the entity ID and its title/summary. In F4, these links are rendered but inert (wired in F5).

If no related entities: display "(none)" in grey text.

**6. Superseded By**

If `documentRecord.superseded_by` is set, show it as an `EntityLink` to the successor document. If not set, show "(none)".

The `supersedes` field (what this document replaced) can be shown as a secondary line if present.

In F4, these links are rendered but inert (wired in F5).

**7. Content Hash Status**

A small, low-prominence line showing the drift detection result:
- Hash matches: `✓ Content verified` in small grey text
- Hash differs: `⚠ Content modified` in small orange text
- No hash available: `— No hash recorded` in small grey text
- File not found: `✗ File missing` in small red text

This supplements the DriftBadge at the top with technical detail for users who want the specifics.

---

## 5. Markdown Rendering

### 5.1 Technology Stack

| Package | Purpose |
|---------|---------|
| `react-markdown` | Base Markdown-to-React renderer |
| `remark-gfm` | GitHub Flavoured Markdown plugin (tables, task lists, strikethrough, autolinks) |
| `rehype-highlight` | Syntax highlighting for fenced code blocks (uses `highlight.js` under the hood) |
| `rehype-sanitize` | XSS protection — strips dangerous HTML from rendered output |

### 5.2 Configuration

The `MarkdownViewer` component configures `react-markdown` with these plugins:

```
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeHighlight, rehypeSanitize]}
  components={customComponents}
>
  {markdownContent}
</ReactMarkdown>
```

The `rehypeSanitize` schema should be based on `defaultSchema` from `rehype-sanitize`, extended to allow `className` on `code` and `pre` elements (required for `rehype-highlight` to apply syntax highlighting classes).

### 5.3 GFM Features

The following GitHub Flavoured Markdown features must render correctly:

| Feature | Example | Expected Rendering |
|---------|---------|-------------------|
| Tables | Pipe-delimited tables | Styled HTML tables with borders and header row |
| Task lists | `- [x] Done` / `- [ ] Todo` | Checkbox items (read-only, not interactive) |
| Strikethrough | `~~deleted~~` | Strikethrough text |
| Autolinks | `https://example.com` | Clickable link |
| Fenced code blocks | Triple-backtick blocks with language | Syntax-highlighted code |

### 5.4 Paper-Width Layout

The Markdown content renders inside a container with:

```
.markdown-content {
  max-width: 700px;
  width: 100%;
  padding: 2rem;
  line-height: 1.7;
}
```

This produces a comfortable reading width similar to printed documents or GitHub's rendered Markdown view.

### 5.5 GitHub-Style Theme

The Markdown rendering should use a clean, readable theme inspired by GitHub's Markdown rendering:

- **Headings**: Clear hierarchy with appropriate font sizes and weight. `h1` and `h2` get a bottom border.
- **Code blocks**: Slightly rounded background (`bg-muted`), with syntax highlighting colours from `highlight.js` github theme (or github-dark for dark mode if added later).
- **Inline code**: Subtle background, monospace font.
- **Blockquotes**: Left border accent, muted text.
- **Tables**: Bordered cells, alternating row backgrounds, header row in bold.
- **Links**: Themed link colour (from Sky theme), underline on hover.
- **Lists**: Proper indentation and bullet styling.
- **Horizontal rules**: Subtle divider.
- **Images**: `max-width: 100%` to prevent overflow.

These styles should be applied via a CSS class wrapping the `react-markdown` output (e.g. `.prose` or a custom `.markdown-content` class), using Tailwind utilities or a small custom stylesheet.

### 5.6 Heading Anchors

Each heading (`h1`–`h6`) gets an `id` attribute derived from its text content (slugified: lowercased, spaces to hyphens, non-alphanumeric stripped). This enables in-page anchor links.

Implementation: Use a custom `components` mapping in `react-markdown` to override heading elements and inject the `id` prop. Optionally display a link icon on hover (like GitHub's heading anchors), but this is a polish detail and not required for F4.

---

## 6. DriftBadge Component

### 6.1 Purpose

The `DriftBadge` encapsulates the logic of combining a document's `status` field with drift detection (content hash comparison) into a single visual indicator.

### 6.2 Props

```
interface DriftBadgeProps {
  status: string;                    // documentRecord.status
  contentHashExpected?: string;      // documentRecord.content_hash (may be absent)
  contentHashActual?: string;        // SHA-256 computed from current file content
  fileMissing?: boolean;             // true if the file was not found on disk
}
```

### 6.3 State Resolution Logic

```
function resolveDriftState(props: DriftBadgeProps): DriftState {
  if (props.status === "superseded") return "superseded";
  if (props.status === "draft")      return "draft";
  if (props.status === "approved") {
    if (props.fileMissing)           return "approved-modified";
    if (!props.contentHashExpected)   return "approved-clean";  // no hash to compare
    if (props.contentHashActual === props.contentHashExpected)
                                     return "approved-clean";
    return "approved-modified";
  }
  // Unknown status — treat as draft-like
  return "draft";
}
```

### 6.4 Visual States

| DriftState | Label | Colour | Icon (optional) |
|------------|-------|--------|-----------------|
| `approved-clean` | Approved | Green (`#22C55E`) | CheckCircle |
| `approved-modified` | Modified since approval | Orange (`#F97316`) | AlertTriangle |
| `draft` | Draft | Grey (`#9CA3AF`) | FileEdit |
| `superseded` | Superseded | Purple (`#A855F7`) | Archive |

Rendered as a `Badge` with the appropriate background colour and label text.

### 6.5 Unknown Status Handling

If `status` is not one of the three known values (`approved`, `draft`, `superseded`), the badge displays the raw status string in grey. The viewer must never crash on an unrecognised status — this ensures forward compatibility with future schema versions.

---

## 7. Document Content Reader

### 7.1 Module Location

`src/lib/reader/document.ts`

### 7.2 Responsibilities

1. Read a Markdown file from disk given a project path and document record
2. Compute the SHA-256 hash of the file content
3. Compare the computed hash against the document record's `content_hash`
4. Handle missing files gracefully

### 7.3 Interface

```
interface DocumentContent {
  markdown: string;          // raw markdown text
  contentHash: string;       // SHA-256 hex digest of the file content
  hashMatches: boolean;      // true if contentHash === documentRecord.content_hash
  fileMissing: false;
}

interface DocumentMissing {
  markdown: null;
  contentHash: null;
  hashMatches: false;
  fileMissing: true;
}

type DocumentReadResult = DocumentContent | DocumentMissing;

async function readDocument(
  projectPath: string,
  documentRecord: DocumentRecord
): Promise<DocumentReadResult>;
```

### 7.4 Implementation Notes

- **File reading**: Use `@tauri-apps/plugin-fs` to read the file at `{projectPath}/{documentRecord.path}`.
- **Hash computation**: Use the Web Crypto API (`crypto.subtle.digest("SHA-256", ...)`) to compute the SHA-256 hash of the UTF-8 encoded file content. Convert the result to a lowercase hex string for comparison.
- **Missing files**: If the file read throws a "not found" error, return the `DocumentMissing` variant. Do not throw — the caller should never need a try/catch for expected conditions.
- **Hash comparison**: Compare the computed hex digest against `documentRecord.content_hash`. If the record has no `content_hash` field, set `hashMatches: true` (no hash to contradict).
- **Encoding**: Read the file as UTF-8 text. Kanbanzai documents are always UTF-8.

### 7.5 Hash Computation Detail

```
async function computeSHA256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
```

This must produce the same hex digest that kanbanzai computes when approving a document. Kanbanzai uses Go's `crypto/sha256` on the raw file bytes (UTF-8), so the `TextEncoder` approach (which produces UTF-8 bytes) will match.

---

## 8. Component Structure

### 8.1 File Layout

```
src/components/document/
├── DocumentList.tsx       # List screen with filter bar and document cards
├── DocumentViewer.tsx     # Viewer screen (content + metadata sidebar)
├── MarkdownViewer.tsx     # Markdown rendering component
├── MetadataPanel.tsx      # Right sidebar metadata display
└── DriftBadge.tsx         # Status + drift detection badge

src/lib/reader/
└── document.ts            # Markdown file reading + SHA-256 hash computation
```

### 8.2 Component Responsibilities

**`DocumentList.tsx`**
- Reads `documents` map from the Zustand project store
- Manages filter state (active type toggles, status toggles)
- Manages sort state (selected sort option)
- Computes the filtered + sorted document list
- Renders the filter bar (ToggleGroups) and sort control
- Renders document rows (cards) with title, date, type badge, status badge
- Handles row click → navigates to DocumentViewer
- Handles lozenge click → toggles the corresponding filter
- Renders empty states when appropriate

**`DocumentViewer.tsx`**
- Receives a `DocumentRecord` (or document ID to look up from the store)
- Calls `readDocument()` to load the Markdown content and compute drift
- Renders the viewer header (back button + title)
- Lays out the content area (MarkdownViewer) and metadata sidebar (MetadataPanel) using the sidebar-15 pattern
- Manages the loading state while the file is being read

**`MarkdownViewer.tsx`**
- Pure rendering component — receives a Markdown string, outputs styled HTML
- Configures `react-markdown` with `remark-gfm`, `rehype-highlight`, `rehype-sanitize`
- Applies the paper-width layout and GitHub-style theme
- Provides custom heading components with anchor IDs
- No data fetching — only presentation

**`MetadataPanel.tsx`**
- Receives a `DocumentRecord` and a `DocumentReadResult`
- Renders all metadata fields (§4.5) in order
- Uses `DriftBadge` for the status display
- Uses `EntityLink` for owner, related entities, and superseded-by references
- Handles missing/absent fields gracefully (shows "(none)" or omits the section)

**`DriftBadge.tsx`**
- Receives drift-related props (§6.2)
- Applies the state resolution logic (§6.3)
- Renders a coloured `Badge` with the appropriate label

### 8.3 Data Flow

```
ProjectState (Zustand store)
  │
  ├─→ DocumentList
  │     │ reads: documents map
  │     │ local state: filters, sort, scroll position
  │     │
  │     └─→ [user clicks row] → DocumentViewer
  │
  └─→ DocumentViewer
        │ reads: specific DocumentRecord from store
        │ calls: readDocument(projectPath, record)
        │
        ├─→ MarkdownViewer (receives: markdown string)
        └─→ MetadataPanel (receives: DocumentRecord + DocumentReadResult)
              └─→ DriftBadge (receives: status + hash data)
```

### 8.4 Documents View Container

A parent component (e.g. `DocumentsView.tsx`) manages the list-vs-viewer navigation state:

```
function DocumentsView() {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  if (selectedDocId) {
    return <DocumentViewer
      documentId={selectedDocId}
      onBack={() => setSelectedDocId(null)}
    />;
  }

  return <DocumentList onSelect={(id) => setSelectedDocId(id)} />;
}
```

To preserve list scroll position and filters across viewer visits, the `DocumentList` should either:
- Store its filter/sort/scroll state in the Zustand UI store, or
- Remain mounted but hidden (`display: none`) when the viewer is active

The UI store approach is recommended as it's simpler and avoids hidden DOM overhead.

---

## 9. Related Entity Resolution

The metadata panel's "Related Entities" section requires a reverse lookup: which entities reference this document?

### 9.1 Lookup Strategy

Scan the entity store for references to the document's ID:

1. **Plans**: Check `plan.design` field
2. **Features**: Check `feature.design` field
3. **Any entity field**: Any string field value matching the document's ID pattern

For F4, the scope is limited to checking `design` fields on plans and features, since those are the structured document reference fields.

### 9.2 Implementation

This can be a simple derived function (or Zustand selector):

```
function getRelatedEntities(
  documentId: string,
  state: ProjectState
): Array<{ id: string; type: string; summary: string }> {
  const related = [];

  for (const [id, plan] of state.plans) {
    if (plan.design === documentId) {
      related.push({ id, type: "plan", summary: plan.title });
    }
  }

  for (const [id, feature] of state.features) {
    if (feature.design === documentId) {
      related.push({ id, type: "feature", summary: feature.summary });
    }
  }

  return related;
}
```

---

## 10. Error Handling

Aligned with the architecture's error handling principles (§8):

| Scenario | Behaviour |
|----------|-----------|
| Document's Markdown file missing on disk | "File not found" message in content area; `DriftBadge` shows orange "Modified since approval" (for approved docs) or "File missing" content hash status |
| Unknown `type` value on a DocumentRecord | Display raw string in a grey badge; filter bar does not include a toggle for it, but the document still appears when no type filters are active |
| Unknown `status` value | Display raw string in a grey badge; DriftBadge falls through to draft-like rendering |
| `content_hash` field absent | No drift detection possible; treat as clean (no warning badge); content hash status shows "No hash recorded" |
| YAML parse error on a document record | The record is skipped by the loader (F1/F2 responsibility); it simply won't appear in the documents map |
| `title` field empty or missing | Fall back to the filename (basename of `path`) as the display title; this should be extremely rare since kanbanzai always sets title |
| `owner` references a non-existent entity | Display the raw ID string; `EntityLink` shows a dimmed "not found" indicator |
| Extremely large Markdown file | Render as-is; no truncation. Performance for very large files can be addressed later with virtualised rendering if needed |

---

## 11. Acceptance Criteria

1. **Document list displays all registered documents** with titles (not filenames), relative dates, type lozenges, and status lozenges.
2. **Type filter toggles** correctly filter the list (OR within type, AND with status).
3. **Status filter toggles** correctly filter the list (OR within status, AND with type).
4. **Lozenge click** in a list row activates the corresponding filter.
5. **Sort control** changes the list order (newest, oldest, title A–Z, title Z–A, type, status).
6. **Default sort** is newest first by date modified.
7. **GFM rendering** correctly displays tables, task lists, strikethrough, and autolinks.
8. **Syntax highlighting** works in fenced code blocks with a language identifier.
9. **Paper-width rendering** constrains Markdown content to ~700px max-width.
10. **Metadata panel** displays status (with drift badge), filename, type, owner, related entities, superseded-by, and content hash status.
11. **Drift detection** correctly identifies when an approved document's content hash no longer matches the on-disk file.
12. **Missing file handling** shows "File not found" in the content area and appropriate indicators in the metadata panel.
13. **Back button** returns to the document list with scroll position and filter state preserved.
14. **Empty states** display correctly for both "no documents" and "no matches" scenarios.
15. **Unknown status/type values** render as grey with the raw string and do not crash.

---

## References

- KBZV Architecture Design: `work/design/kbzv-architecture.md` §4.1 (DocumentRecord), §6.1 (Design Fundamentals), §6.4 (Documents View), §6.5 (Status Colours), §6.7 (Filter Bar), §6.8 (Component Mapping), §7 (Navigation Model), §8 (Error Handling)
- shadcn/ui sidebar-15 block: content + right sidebar layout pattern
- react-markdown: https://github.com/remarkjs/react-markdown
- remark-gfm: https://github.com/remarkjs/remark-gfm
- rehype-highlight: https://github.com/rehypejs/rehype-highlight
- rehype-sanitize: https://github.com/rehypejs/rehype-sanitize