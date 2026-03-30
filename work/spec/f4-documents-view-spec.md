# F4: Documents View — Specification

| Field       | Value                                      |
|-------------|--------------------------------------------|
| Feature ID  | FEAT-01KMZA9JMZFNF                        |
| Parent Plan | P1-kbzv                                    |
| Depends On  | FEAT-01KMZA96W1J98 (F1), FEAT-01KMZA9CP9XEX (F2) |
| Type        | Specification                              |
| Status      | Draft                                      |

**Source design:** `work/design/f4-documents-view.md`
**Architecture reference:** `work/design/kbzv-architecture.md` §6.4–6.5, §7, §8

---

## 1. File Manifest

Every file created or modified by this feature, with full paths relative to project root:

| # | Path | Purpose | New / Modified |
|---|------|---------|----------------|
| 1 | `src/components/document/DocumentsView.tsx` | Container: list ↔ viewer navigation, scroll preservation | New |
| 2 | `src/components/document/DocumentList.tsx` | Filterable, sortable document list | New |
| 3 | `src/components/document/DocumentViewer.tsx` | Viewer layout: content area + metadata sidebar | New |
| 4 | `src/components/document/MarkdownViewer.tsx` | `react-markdown` wrapper with GFM, highlighting, sanitization | New |
| 5 | `src/components/document/MetadataPanel.tsx` | Right sidebar metadata fields | New |
| 6 | `src/components/document/DriftBadge.tsx` | Status + drift-detection badge | New |
| 7 | `src/lib/reader/document.ts` | Read Markdown file from disk, compute SHA-256, return drift result | New |
| 8 | `src/lib/query/references.ts` | `getRelatedEntities()` reverse lookup (add document-related exports) | Modified |
| 9 | `src/lib/constants/type-colours.ts` | Document-type → colour mapping | New |
| 10 | `src/styles/markdown.css` | GitHub-style Markdown prose theme, `highlight.js` github theme import | New |

**Dependencies required (npm):**

| Package | Version | Purpose |
|---------|---------|---------|
| `react-markdown` | `^9.0.0` | Markdown → React renderer |
| `remark-gfm` | `^4.0.0` | GitHub Flavoured Markdown |
| `rehype-highlight` | `^7.0.0` | Syntax highlighting (uses highlight.js) |
| `rehype-sanitize` | `^6.0.0` | XSS protection |
| `highlight.js` | `^11.9.0` | Peer dep of rehype-highlight; provides language grammars |

---

## 2. Document List

### 2.1 DocumentList.tsx — Props, State, Rendering

```typescript
// --- Props ---

interface DocumentListProps {
  /** Called when the user clicks a document row. Receives the document record ID. */
  onSelect: (documentId: string) => void;

  /** Restored filter/sort state from the parent container (scroll preservation). */
  initialFilters?: DocumentListFilters;

  /** Callback fired whenever filters or sort change, so the parent can persist. */
  onFiltersChange?: (filters: DocumentListFilters) => void;
}

interface DocumentListFilters {
  activeTypes: Set<string>;
  activeStatuses: Set<string>;
  sortOption: SortOption;
  scrollTop: number;
}

// --- Local State ---

const [activeTypes, setActiveTypes] = useState<Set<string>>(
  props.initialFilters?.activeTypes ?? new Set()
);
const [activeStatuses, setActiveStatuses] = useState<Set<string>>(
  props.initialFilters?.activeStatuses ?? new Set()
);
const [sortOption, setSortOption] = useState<SortOption>(
  props.initialFilters?.sortOption ?? "newest"
);

// scrollTop is tracked via a ref on the scroll container
const scrollContainerRef = useRef<HTMLDivElement>(null);
```

**Data source:** `useProjectStore((s) => s.documents)` — the Zustand `Map<string, DocumentRecord>`.

**Rendering order:**

1. Filter bar (type toggles, status toggles, sort control) — fixed at top
2. Scroll container with document rows
3. Empty state (conditional)

### 2.2 List Row Anatomy — Exact Fields, Layout, Tailwind Classes

Each row is a single `<button>` element (semantic clickability) styled as a card:

```
┌─────────────────────────────────────────────────────────────┐
│  Title text                          [type badge] [status]  │
│  3 days ago                                                 │
└─────────────────────────────────────────────────────────────┘
```

**Outer container (the row):**

```
className="flex items-start justify-between w-full rounded-lg border
           border-border bg-card px-4 py-3 text-left transition-colors
           hover:bg-accent hover:text-accent-foreground cursor-pointer
           focus-visible:outline-none focus-visible:ring-2
           focus-visible:ring-ring focus-visible:ring-offset-2"
```

**Left column (title + date):**

```
<div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-3">
  <span className="text-sm font-medium leading-tight truncate">
    {documentRecord.title || basename(documentRecord.path)}
  </span>
  <Tooltip content={documentRecord.updated}>
    <span className="text-xs text-muted-foreground">
      {formatRelativeDate(documentRecord.updated)}
    </span>
  </Tooltip>
</div>
```

**Right column (badges):**

```
<div className="flex items-center gap-1.5 shrink-0 pt-0.5">
  <Badge className={typeColourClass}>{documentRecord.type}</Badge>
  <Badge className={statusColourClass}>{documentRecord.status}</Badge>
</div>
```

**Badge click handler (lozenge-as-filter shortcut):**

Each badge has an `onClick` with `e.stopPropagation()` that toggles the corresponding filter value:

```typescript
function handleTypeBadgeClick(e: React.MouseEvent, type: string) {
  e.stopPropagation(); // prevent row navigation
  setActiveTypes((prev) => {
    const next = new Set(prev);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    return next;
  });
}
```

Same pattern for status badge click.

### 2.3 Sort Control — Options, Comparators, Default

**Sort control component:** shadcn `Select` component, right-aligned in the filter bar.

```typescript
type SortOption =
  | "newest"
  | "oldest"
  | "title-asc"
  | "title-desc"
  | "type"
  | "status";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest",    label: "Newest first" },
  { value: "oldest",    label: "Oldest first" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "title-desc",label: "Title Z–A" },
  { value: "type",      label: "Type" },
  { value: "status",    label: "Status" },
];

const DEFAULT_SORT: SortOption = "newest";
```

**Comparator functions (all stable — equal items retain insertion order):**

```typescript
function sortDocuments(
  docs: DocumentRecord[],
  option: SortOption
): DocumentRecord[] {
  return [...docs].sort((a, b) => {
    switch (option) {
      case "newest":
        return b.updated.localeCompare(a.updated); // ISO 8601 strings sort correctly
      case "oldest":
        return a.updated.localeCompare(b.updated);
      case "title-asc":
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      case "title-desc":
        return b.title.localeCompare(a.title, undefined, { sensitivity: "base" });
      case "type":
        return a.type.localeCompare(b.type);
      case "status":
        return a.status.localeCompare(b.status);
    }
  });
}
```

### 2.4 Filter Bar — Type Toggles, Status Toggles, AND Logic

**Layout:**

```
<div className="flex items-center gap-4 px-4 py-2 border-b border-border">
  {/* Type filters */}
  <ToggleGroup type="multiple" value={[...activeTypes]} onValueChange={handleTypeChange}>
    {KNOWN_DOC_TYPES.map((t) => (
      <ToggleGroupItem key={t} value={t} size="sm">{t}</ToggleGroupItem>
    ))}
  </ToggleGroup>

  {/* Spacer or visual separator */}
  <Separator orientation="vertical" className="h-5" />

  {/* Status filters */}
  <ToggleGroup type="multiple" value={[...activeStatuses]} onValueChange={handleStatusChange}>
    <ToggleGroupItem value="approved" size="sm">
      <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#22C55E]" />
      Approved
    </ToggleGroupItem>
    <ToggleGroupItem value="draft" size="sm">
      <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#9CA3AF]" />
      Draft
    </ToggleGroupItem>
    <ToggleGroupItem value="superseded" size="sm">
      <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#A855F7]" />
      Superseded
    </ToggleGroupItem>
  </ToggleGroup>

  {/* Push sort to the right */}
  <div className="ml-auto">
    <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
      <SelectTrigger className="w-[160px] h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
</div>
```

**Known document types constant:**

```typescript
const KNOWN_DOC_TYPES = [
  "design",
  "specification",
  "dev-plan",
  "research",
  "report",
  "policy",
] as const;
```

Note: `rca` is a valid type in the schema but is rare enough to omit from the filter bar. Documents with type `rca` or any unknown type still appear when no type filters are active, and are never hidden by type filters they cannot match.

**Filter combination algorithm:**

```typescript
function filterDocuments(
  docs: DocumentRecord[],
  activeTypes: Set<string>,
  activeStatuses: Set<string>
): DocumentRecord[] {
  return docs.filter((doc) => {
    // OR within type category: document must match at least one active type.
    // No active types = no restriction.
    const matchesType =
      activeTypes.size === 0 || activeTypes.has(doc.type);

    // OR within status category: document must match at least one active status.
    // No active statuses = no restriction.
    const matchesStatus =
      activeStatuses.size === 0 || activeStatuses.has(doc.status);

    // AND across categories.
    return matchesType && matchesStatus;
  });
}
```

**Full pipeline:**

```typescript
const allDocs = useMemo(
  () => Array.from(documents.values()),
  [documents]
);
const filtered = useMemo(
  () => filterDocuments(allDocs, activeTypes, activeStatuses),
  [allDocs, activeTypes, activeStatuses]
);
const sorted = useMemo(
  () => sortDocuments(filtered, sortOption),
  [filtered, sortOption]
);
```

### 2.5 Type Colours — Hex Values for Each Document Type

These are **distinct from status colours**. They use muted tones from the Tailwind palette that harmonise with the Mist/Sky theme.

| Type | Hex Background | Hex Text | Tailwind Class Equivalent |
|------|---------------|----------|---------------------------|
| `design` | `#DBEAFE` | `#1E40AF` | `bg-blue-100 text-blue-800` |
| `specification` | `#CCFBF1` | `#115E59` | `bg-teal-100 text-teal-800` |
| `dev-plan` | `#E0E7FF` | `#3730A3` | `bg-indigo-100 text-indigo-800` |
| `research` | `#FEF3C7` | `#92400E` | `bg-amber-100 text-amber-800` |
| `report` | `#F1F5F9` | `#334155` | `bg-slate-100 text-slate-700` |
| `policy` | `#FFE4E6` | `#9F1239` | `bg-rose-100 text-rose-800` |
| `rca` | `#FFEDD5` | `#9A3412` | `bg-orange-100 text-orange-800` |
| Unknown | `#F3F4F6` | `#4B5563` | `bg-gray-100 text-gray-600` |

**Implementation in `src/lib/constants/type-colours.ts`:**

```typescript
export interface TypeColour {
  bg: string;   // Tailwind bg class
  text: string; // Tailwind text class
}

export const DOC_TYPE_COLOURS: Record<string, TypeColour> = {
  "design":        { bg: "bg-blue-100",   text: "text-blue-800" },
  "specification": { bg: "bg-teal-100",   text: "text-teal-800" },
  "dev-plan":      { bg: "bg-indigo-100", text: "text-indigo-800" },
  "research":      { bg: "bg-amber-100",  text: "text-amber-800" },
  "report":        { bg: "bg-slate-100",  text: "text-slate-700" },
  "policy":        { bg: "bg-rose-100",   text: "text-rose-800" },
  "rca":           { bg: "bg-orange-100", text: "text-orange-800" },
};

const UNKNOWN_TYPE_COLOUR: TypeColour = {
  bg: "bg-gray-100",
  text: "text-gray-600",
};

export function getTypeColour(type: string): TypeColour {
  return DOC_TYPE_COLOURS[type] ?? UNKNOWN_TYPE_COLOUR;
}
```

**Badge rendering with type colours:**

```tsx
function TypeBadge({ type }: { type: string }) {
  const colour = getTypeColour(type);
  return (
    <Badge
      variant="secondary"
      className={cn(colour.bg, colour.text, "border-0 font-normal")}
    >
      {type}
    </Badge>
  );
}
```

### 2.6 Empty State

Two variants, rendered when the `sorted` array is empty:

**No documents at all** (`allDocs.length === 0`):

```tsx
<EmptyState
  icon={FileText}
  heading="No documents"
  body="This project has no registered documents."
/>
```

**All filtered out** (`allDocs.length > 0 && sorted.length === 0`):

```tsx
<EmptyState
  icon={Filter}
  heading="No matches"
  body="No documents match the active filters."
  action={
    <Button variant="link" size="sm" onClick={clearAllFilters}>
      Clear filters
    </Button>
  }
/>
```

`clearAllFilters` resets `activeTypes` and `activeStatuses` to empty sets.

---

## 3. Document Viewer

### 3.1 DocumentViewer.tsx — Props, State, Rendering

```typescript
interface DocumentViewerProps {
  /** The ID of the document record to display. */
  documentId: string;
  /** Called when the user clicks the back button. */
  onBack: () => void;
}
```

**Internal state:**

```typescript
const [readResult, setReadResult] = useState<DocumentReadResult | null>(null);
const [isLoading, setIsLoading] = useState(true);
```

**Data flow on mount:**

```typescript
useEffect(() => {
  let cancelled = false;
  setIsLoading(true);

  const record = useProjectStore.getState().documents.get(documentId);
  const projectPath = useProjectStore.getState().projectPath;

  if (!record || !projectPath) {
    setReadResult({ markdown: null, contentHash: null, hashMatches: false, fileMissing: true });
    setIsLoading(false);
    return;
  }

  readDocument(projectPath, record).then((result) => {
    if (!cancelled) {
      setReadResult(result);
      setIsLoading(false);
    }
  });

  return () => { cancelled = true; };
}, [documentId]);
```

**Layout (sidebar-15 pattern):**

```
<div className="flex flex-col h-full">
  {/* Viewer header */}
  <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
    <Button variant="ghost" size="sm" onClick={onBack}>
      <ChevronLeft className="h-4 w-4 mr-1" />
      Back
    </Button>
    <h1 className="text-lg font-semibold truncate">{record.title}</h1>
  </div>

  {/* Content + sidebar */}
  <div className="flex flex-1 min-h-0 overflow-hidden">
    {/* Content area — scrolls independently */}
    <div className="flex-1 overflow-y-auto px-8 py-6">
      {isLoading ? (
        <LoadingState message="Loading document…" />
      ) : readResult?.fileMissing ? (
        <EmptyState
          icon={FileX}
          heading="File not found"
          body={`The file ${record.path} could not be found.`}
        />
      ) : (
        <MarkdownViewer content={readResult!.markdown!} />
      )}
    </div>

    {/* Metadata sidebar */}
    <div className="w-[260px] shrink-0 border-l border-border overflow-y-auto">
      <MetadataPanel record={record} readResult={readResult} />
    </div>
  </div>
</div>
```

### 3.2 Back Button Behaviour and State Preservation

The back button calls `onBack()`, which sets `selectedDocId` to `null` in the parent `DocumentsView` container.

**State that must be preserved across viewer visits:**

| State | Preservation mechanism |
|-------|----------------------|
| Filter toggles (activeTypes, activeStatuses) | Stored in Zustand UI store |
| Sort option | Stored in Zustand UI store |
| Scroll position | Stored in Zustand UI store; restored via `scrollContainerRef.current.scrollTop` in a `useLayoutEffect` |

**UI store shape (additions):**

```typescript
// In src/lib/store/ui-store.ts
interface UIState {
  // ... existing fields ...

  documentListFilters: DocumentListFilters;
  setDocumentListFilters: (filters: DocumentListFilters) => void;
}

interface DocumentListFilters {
  activeTypes: string[];    // serialisable (Set is not JSON-friendly in Zustand)
  activeStatuses: string[];
  sortOption: SortOption;
  scrollTop: number;
}
```

`DocumentList` reads from the UI store on mount and writes back on every change via `onFiltersChange`.

### 3.3 Content Area — MarkdownViewer Integration

The content area renders `<MarkdownViewer content={markdown} />` where `markdown` is the raw string from `readDocument()`.

- The `MarkdownViewer` is a pure presentation component. It receives a string and renders styled HTML.
- The content area provides the scrolling container; `MarkdownViewer` does not scroll itself.
- The paper-width constraint (`max-width: 700px`) lives inside `MarkdownViewer`.

### 3.4 Metadata Panel — Exact Field List, Order, Rendering

See §6 for the full `MetadataPanel` specification. The panel receives:

```typescript
interface MetadataPanelProps {
  record: DocumentRecord;
  readResult: DocumentReadResult | null;
}
```

---

## 4. Markdown Rendering

### 4.1 MarkdownViewer.tsx — Props, Configuration

```typescript
interface MarkdownViewerProps {
  /** Raw Markdown string to render. */
  content: string;
}
```

This is a **pure rendering component** — no data fetching, no side effects, no internal state. Given a Markdown string, it returns styled HTML.

### 4.2 react-markdown Configuration — Exact Plugin List and Options

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

// Extend the default sanitize schema to allow highlight.js class names
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ["className", /^hljs-/, /^language-/],
    ],
    pre: [
      ...(defaultSchema.attributes?.pre ?? []),
      ["className", /^hljs/],
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["className", /^hljs-/],
    ],
  },
};

function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="markdown-content prose prose-slate max-w-[700px] w-full">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeHighlight,
          [rehypeSanitize, sanitizeSchema],
        ]}
        components={customComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

**Plugin ordering matters:** `rehypeHighlight` must come **before** `rehypeSanitize` in the array so that highlight.js class names are present when the sanitizer runs and can be allowed through.

### 4.3 Custom Component Overrides (Headings, Links, Code Blocks)

```typescript
import type { Components } from "react-markdown";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function createHeadingComponent(level: 1 | 2 | 3 | 4 | 5 | 6) {
  const Tag = `h${level}` as const;
  return function HeadingComponent({
    children,
    ...props
  }: React.HTMLAttributes<HTMLHeadingElement>) {
    const text = getTextContent(children);
    const id = slugify(text);
    return (
      <Tag id={id} {...props}>
        {children}
      </Tag>
    );
  };
}

/** Recursively extract text content from React children. */
function getTextContent(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(getTextContent).join("");
  if (children && typeof children === "object" && "props" in children) {
    return getTextContent((children as React.ReactElement).props.children);
  }
  return "";
}

const customComponents: Components = {
  h1: createHeadingComponent(1),
  h2: createHeadingComponent(2),
  h3: createHeadingComponent(3),
  h4: createHeadingComponent(4),
  h5: createHeadingComponent(5),
  h6: createHeadingComponent(6),

  // Links open externally via Tauri shell (or are inert for relative URLs)
  a: ({ href, children, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sky-600 hover:underline"
      {...props}
    >
      {children}
    </a>
  ),

  // Images are constrained to the container width
  img: ({ src, alt, ...props }) => (
    <img
      src={src}
      alt={alt ?? ""}
      className="max-w-full h-auto rounded"
      loading="lazy"
      {...props}
    />
  ),

  // Task list items: disable the checkbox input
  input: ({ type, checked, ...props }) => {
    if (type === "checkbox") {
      return (
        <input
          type="checkbox"
          checked={checked}
          disabled
          className="mr-1.5 pointer-events-none"
          {...props}
        />
      );
    }
    return <input type={type} {...props} />;
  },
};
```

### 4.4 Paper-Width CSS — Exact Tailwind Classes

The outer wrapper constraining content to a comfortable reading width:

```
className="markdown-content prose prose-slate max-w-[700px] w-full"
```

Breakdown:

| Class | Purpose |
|-------|---------|
| `markdown-content` | Custom class for additional theme overrides in `markdown.css` |
| `prose` | Tailwind Typography plugin — provides baseline heading sizes, spacing, list styling |
| `prose-slate` | Slate colour variant — matches the Mist/Sky theme |
| `max-w-[700px]` | Paper-width constraint (700px) for comfortable reading |
| `w-full` | Stretches to 700px on wide screens; shrinks naturally on narrow ones |

The content area scrolling container (in `DocumentViewer.tsx`) provides the padding:

```
className="flex-1 overflow-y-auto px-8 py-6"
```

| Class | Purpose |
|-------|---------|
| `flex-1` | Fill available width beside the metadata sidebar |
| `overflow-y-auto` | Independent vertical scroll |
| `px-8` | 32px horizontal padding around the paper-width content |
| `py-6` | 24px vertical padding top/bottom |

### 4.5 GitHub-Style Theme — Typography, Spacing, Colours

Defined in `src/styles/markdown.css` and imported globally:

```css
/* src/styles/markdown.css */

/* Import highlight.js GitHub theme */
@import "highlight.js/styles/github.css";

/*
 * GitHub-style Markdown theme overrides.
 * Applied inside the `.markdown-content` wrapper.
 * Tailwind `prose` handles most defaults; these are surgical refinements.
 */

.markdown-content {
  line-height: 1.7;
  color: var(--foreground);
}

/* Heading bottom borders for h1 and h2 */
.markdown-content h1 {
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--border);
}
.markdown-content h2 {
  padding-bottom: 0.25em;
  border-bottom: 1px solid var(--border);
}

/* Code blocks */
.markdown-content pre {
  background-color: hsl(var(--muted));
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  padding: 1rem;
  overflow-x: auto;
  font-size: 0.875rem;
  line-height: 1.6;
}

.markdown-content pre code {
  background: none;
  border: none;
  padding: 0;
  font-size: inherit;
}

/* Inline code */
.markdown-content :not(pre) > code {
  background-color: hsl(var(--muted));
  border-radius: 0.25rem;
  padding: 0.15em 0.35em;
  font-size: 0.875em;
  font-family: ui-monospace, "SF Mono", "Cascadia Code", "Segoe UI Mono", monospace;
}

/* Blockquotes */
.markdown-content blockquote {
  border-left: 3px solid hsl(var(--border));
  color: hsl(var(--muted-foreground));
  padding-left: 1em;
  margin-left: 0;
  font-style: normal;
}

/* Tables */
.markdown-content table {
  border-collapse: collapse;
  width: 100%;
}
.markdown-content th,
.markdown-content td {
  border: 1px solid var(--border);
  padding: 0.5em 0.75em;
  text-align: left;
}
.markdown-content th {
  font-weight: 600;
  background-color: hsl(var(--muted));
}
.markdown-content tr:nth-child(even) {
  background-color: hsl(var(--muted) / 0.3);
}

/* Links */
.markdown-content a {
  color: hsl(var(--primary));
  text-decoration: none;
}
.markdown-content a:hover {
  text-decoration: underline;
}

/* Horizontal rules */
.markdown-content hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 2em 0;
}

/* Images */
.markdown-content img {
  max-width: 100%;
  height: auto;
}

/* Task list checkboxes */
.markdown-content ul:has(input[type="checkbox"]) {
  list-style: none;
  padding-left: 0;
}
.markdown-content li:has(> input[type="checkbox"]) {
  display: flex;
  align-items: baseline;
  gap: 0.25em;
}
```

### 4.6 Syntax Highlighting Configuration

`rehype-highlight` uses `highlight.js` under the hood. Configuration:

- **Theme:** GitHub light theme — imported via `@import "highlight.js/styles/github.css"` in `markdown.css`.
- **Language auto-detection:** Enabled by default. Fenced code blocks with a language identifier (e.g. ` ```typescript `) receive the appropriate grammar; blocks without a language are auto-detected.
- **No additional `rehype-highlight` options needed** — the default configuration handles language detection and class injection.

The `rehypeSanitize` schema (§4.2) explicitly allows `hljs-*` classes on `span`, `code`, and `pre` elements so highlighting survives sanitization.

### 4.7 Heading Anchors — Generation Algorithm

The `slugify` function in §4.3 generates heading IDs:

**Algorithm:**

1. Extract the text content from the heading's React children (recursive, handles nested `<code>`, `<em>`, etc.)
2. Convert to lowercase
3. Remove all characters that are not `a-z`, `0-9`, whitespace, or hyphens
4. Replace one or more whitespace characters with a single hyphen
5. Collapse consecutive hyphens to one
6. Strip leading and trailing hyphens

**Examples:**

| Heading Text | Generated ID |
|-------------|-------------|
| `Overview` | `overview` |
| `2.1 Data Model` | `21-data-model` |
| `Why Tauri over Alternatives` | `why-tauri-over-alternatives` |
| `SHA-256 Computation` | `sha-256-computation` |
| `Hello, World!` | `hello-world` |

**Duplicate IDs:** Not handled in F4. In practice, duplicate headings in a single Markdown file are rare. If needed in a future iteration, append `-1`, `-2`, etc.

---

## 5. Drift Detection

### 5.1 document.ts (reader) — readDocumentContent() Function

**File:** `src/lib/reader/document.ts`

```typescript
import { readTextFile } from "@tauri-apps/plugin-fs";

// --- Public Types ---

interface DocumentContent {
  markdown: string;
  contentHash: string;
  hashMatches: boolean;
  fileMissing: false;
}

interface DocumentMissing {
  markdown: null;
  contentHash: null;
  hashMatches: false;
  fileMissing: true;
}

type DocumentReadResult = DocumentContent | DocumentMissing;

// --- Public API ---

async function readDocument(
  projectPath: string,
  documentRecord: DocumentRecord
): Promise<DocumentReadResult> {
  const fullPath = `${projectPath}/${documentRecord.path}`;

  let content: string;
  try {
    content = await readTextFile(fullPath);
  } catch (err: unknown) {
    // File not found — return the missing variant.
    // readTextFile throws on any FS error; we treat all as "missing" since
    // we cannot meaningfully distinguish ENOENT from EACCES in Tauri's plugin-fs.
    return { markdown: null, contentHash: null, hashMatches: false, fileMissing: true };
  }

  const contentHash = await computeSHA256(content);

  // If the record has no content_hash, there is nothing to compare against.
  // Treat as clean — no warning should be raised for pre-approval documents.
  const hashMatches =
    !documentRecord.content_hash ||
    contentHash === documentRecord.content_hash;

  return {
    markdown: content,
    contentHash,
    hashMatches,
    fileMissing: false,
  };
}

export { readDocument };
export type { DocumentReadResult, DocumentContent, DocumentMissing };
```

### 5.2 SHA-256 Computation — Exact Algorithm Using Web Crypto API

```typescript
async function computeSHA256(content: string): Promise<string> {
  const encoder = new TextEncoder();          // UTF-8 by spec
  const data = encoder.encode(content);       // Uint8Array of UTF-8 bytes
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

**Correctness guarantee:** Kanbanzai (Go) computes SHA-256 with `crypto/sha256` over the raw file bytes, which are UTF-8. `TextEncoder.encode()` produces the same UTF-8 byte sequence, so the hex digests match.

**Output format:** 64-character lowercase hexadecimal string (e.g. `a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a`).

### 5.3 DriftBadge.tsx — Props, State Resolution, Visual States

```typescript
// --- Props ---

interface DriftBadgeProps {
  /** The document record's status field (e.g. "approved", "draft", "superseded"). */
  status: string;
  /** The content_hash from the document record (may be undefined). */
  contentHashExpected?: string;
  /** SHA-256 hex digest computed from the current file on disk (may be undefined if file missing). */
  contentHashActual?: string;
  /** True if the file was not found on disk. */
  fileMissing?: boolean;
}

// --- Drift State ---

type DriftState = "approved-clean" | "approved-modified" | "draft" | "superseded";
```

**State resolution function:**

```typescript
function resolveDriftState(props: DriftBadgeProps): DriftState {
  if (props.status === "superseded") return "superseded";
  if (props.status === "draft")      return "draft";
  if (props.status === "approved") {
    if (props.fileMissing)           return "approved-modified";
    if (!props.contentHashExpected)   return "approved-clean"; // no hash to compare
    if (props.contentHashActual === props.contentHashExpected)
                                     return "approved-clean";
    return "approved-modified";
  }
  // Unknown status — render as draft-like (grey)
  return "draft";
}
```

### 5.4 Four Drift States — Exact Badge Text, Colours, Icons

| DriftState | Label Text | Background Hex | Text Hex | Tailwind Classes | Lucide Icon |
|------------|-----------|----------------|----------|------------------|-------------|
| `approved-clean` | `Approved` | `#DCFCE7` | `#166534` | `bg-green-100 text-green-800` | `CheckCircle` |
| `approved-modified` | `Modified since approval` | `#FFEDD5` | `#9A3412` | `bg-orange-100 text-orange-800` | `AlertTriangle` |
| `draft` | `Draft` | `#F3F4F6` | `#4B5563` | `bg-gray-100 text-gray-600` | `FileEdit` |
| `superseded` | `Superseded` | `#F3E8FF` | `#6B21A8` | `bg-purple-100 text-purple-800` | `Archive` |

**Unknown status rendering:** When `status` is not `approved`, `draft`, or `superseded`, the badge displays the raw status string using the `draft` visual style (grey background, grey text, `FileEdit` icon).

**Rendering:**

```tsx
import { CheckCircle, AlertTriangle, FileEdit, Archive } from "lucide-react";

const DRIFT_VISUALS: Record<DriftState, {
  label?: string;
  bg: string;
  text: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  "approved-clean":    { label: "Approved",                  bg: "bg-green-100",  text: "text-green-800",  Icon: CheckCircle },
  "approved-modified": { label: "Modified since approval",   bg: "bg-orange-100", text: "text-orange-800", Icon: AlertTriangle },
  "draft":             { label: "Draft",                     bg: "bg-gray-100",   text: "text-gray-600",   Icon: FileEdit },
  "superseded":        { label: "Superseded",                bg: "bg-purple-100", text: "text-purple-800", Icon: Archive },
};

function DriftBadge(props: DriftBadgeProps) {
  const state = resolveDriftState(props);
  const visual = DRIFT_VISUALS[state];
  const Icon = visual.Icon;

  // For unknown statuses that fall through to "draft", show the raw string
  const label =
    state === "draft" && props.status !== "draft"
      ? props.status
      : visual.label;

  return (
    <Badge
      variant="secondary"
      className={cn(visual.bg, visual.text, "border-0 gap-1")}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}
```

---

## 6. Metadata Panel

### 6.1 MetadataPanel.tsx — Props, Field Order

```typescript
interface MetadataPanelProps {
  record: DocumentRecord;
  readResult: DocumentReadResult | null;
}
```

**Padding and layout:**

```
className="px-4 py-4 space-y-5"
```

**Fields rendered top-to-bottom, in this exact order:**

| # | Field | Component / Rendering |
|---|-------|-----------------------|
| 1 | Status (with drift) | `DriftBadge` — prominent at top |
| 2 | Filename | Small grey monospace text |
| 3 | Type | `TypeBadge` (coloured badge) |
| 4 | Owner | `EntityLink` (inert in F4) or "(none)" |
| 5 | Related Entities | List of `EntityLink` items or "(none)" |
| 6 | Superseded By | `EntityLink` to successor document or "(none)" |
| 7 | Content Hash Status | Small text with symbol indicator |

**Each field section follows this pattern:**

```tsx
<div>
  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
    {fieldLabel}
  </div>
  <div>
    {fieldContent}
  </div>
</div>
```

**Field 1 — Status:**

```tsx
<DriftBadge
  status={record.status}
  contentHashExpected={record.content_hash}
  contentHashActual={readResult?.fileMissing === false ? readResult.contentHash : undefined}
  fileMissing={readResult?.fileMissing ?? false}
/>
```

**Field 2 — Filename:**

```tsx
<span className="text-xs text-muted-foreground font-mono break-all">
  {record.path}
</span>
```

**Field 3 — Type:**

```tsx
<TypeBadge type={record.type} />
```

**Field 4 — Owner:**

```tsx
{record.owner ? (
  <EntityLink entityId={record.owner} />
) : (
  <span className="text-sm text-muted-foreground">(none)</span>
)}
```

**Field 5 — Related Entities:**

```tsx
{relatedEntities.length > 0 ? (
  <div className="space-y-1">
    {relatedEntities.map((entity) => (
      <EntityLink key={entity.id} entityId={entity.id} subtitle={entity.summary} />
    ))}
  </div>
) : (
  <span className="text-sm text-muted-foreground">(none)</span>
)}
```

**Field 6 — Superseded By:**

```tsx
{record.superseded_by ? (
  <EntityLink entityId={record.superseded_by} />
) : (
  <span className="text-sm text-muted-foreground">(none)</span>
)}
```

If `record.supersedes` is also set, render a secondary line below:

```tsx
{record.supersedes && (
  <div className="mt-1">
    <span className="text-xs text-muted-foreground">Supersedes: </span>
    <EntityLink entityId={record.supersedes} />
  </div>
)}
```

**Field 7 — Content Hash Status:**

Four visual sub-states, displayed as small informational text:

| Condition | Symbol | Text | Tailwind Classes |
|-----------|--------|------|-----------------|
| `readResult.fileMissing === false` AND `readResult.hashMatches === true` | ✓ | Content verified | `text-xs text-muted-foreground` |
| `readResult.fileMissing === false` AND `readResult.hashMatches === false` | ⚠ | Content modified | `text-xs text-orange-600` |
| `record.content_hash` is absent | — | No hash recorded | `text-xs text-muted-foreground` |
| `readResult.fileMissing === true` | ✗ | File missing | `text-xs text-red-500` |

```tsx
function ContentHashStatus({
  record,
  readResult,
}: {
  record: DocumentRecord;
  readResult: DocumentReadResult | null;
}) {
  if (!readResult) {
    return <span className="text-xs text-muted-foreground">— Loading…</span>;
  }

  if (readResult.fileMissing) {
    return <span className="text-xs text-red-500">✗ File missing</span>;
  }

  if (!record.content_hash) {
    return <span className="text-xs text-muted-foreground">— No hash recorded</span>;
  }

  if (readResult.hashMatches) {
    return <span className="text-xs text-muted-foreground">✓ Content verified</span>;
  }

  return <span className="text-xs text-orange-600">⚠ Content modified</span>;
}
```

### 6.2 Related Entity Resolution — Reverse Lookup Algorithm

**File:** `src/lib/query/references.ts` (add this export)

```typescript
interface RelatedEntity {
  id: string;
  type: "plan" | "feature";
  summary: string;
}

function getRelatedEntities(
  documentId: string,
  state: ProjectState
): RelatedEntity[] {
  const related: RelatedEntity[] = [];

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

**Usage in MetadataPanel:**

```typescript
const relatedEntities = useProjectStore((state) =>
  getRelatedEntities(record.id, state)
);
```

This performs a linear scan of plans and features on each render. With typical project sizes (<100 plans, <500 features), this is negligible. Memoisation via `useMemo` with `[record.id, plans, features]` deps is acceptable for correctness but not required for performance.

### 6.3 EntityLink Rendering (Navigation Stubbed for F5)

The `EntityLink` component already exists in `src/components/common/EntityLink.tsx` (from F2 or architectural plan). In F4:

- **Rendered:** Shows the entity ID and, if available, the entity's title/summary from the store.
- **Inert:** The `onClick` handler is a no-op. The link uses `cursor-default` (not `cursor-pointer`) in F4.
- **Not-found indicator:** If the entity ID is not found in the store, render the raw ID with a dimmed style:

```tsx
function EntityLink({
  entityId,
  subtitle,
}: {
  entityId: string;
  subtitle?: string;
}) {
  const entity = useResolvedEntity(entityId); // looks up across all entity maps

  return (
    <span className="text-sm">
      <span className={entity ? "text-foreground" : "text-muted-foreground/60"}>
        {entityId}
      </span>
      {subtitle && (
        <span className="text-xs text-muted-foreground ml-1">{subtitle}</span>
      )}
      {!entity && (
        <Tooltip content="Entity not found">
          <span className="text-muted-foreground/40 ml-0.5 text-xs">(not found)</span>
        </Tooltip>
      )}
    </span>
  );
}
```

F5 will change `<span>` to `<button>` with an `onClick` that navigates to the Workflows view and selects the entity.

---

## 7. Documents View Container

### 7.1 DocumentsView.tsx — State Management, View Switching

```typescript
function DocumentsView() {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const filters = useUIStore((s) => s.documentListFilters);
  const setFilters = useUIStore((s) => s.setDocumentListFilters);

  if (selectedDocId) {
    return (
      <DocumentViewer
        documentId={selectedDocId}
        onBack={() => setSelectedDocId(null)}
      />
    );
  }

  return (
    <DocumentList
      onSelect={(id) => setSelectedDocId(id)}
      initialFilters={filters}
      onFiltersChange={setFilters}
    />
  );
}
```

**Key design decision:** The list and viewer are **conditionally rendered** (not simultaneously mounted with `display: none`). State preservation is achieved through the Zustand UI store rather than DOM persistence. This keeps the DOM lightweight and avoids the complexity of hidden components.

### 7.2 Scroll Position Preservation Strategy

**Saving scroll position:**

`DocumentList` attaches a `scroll` event listener to its scroll container and debounces updates to the UI store:

```typescript
useEffect(() => {
  const el = scrollContainerRef.current;
  if (!el) return;

  let rafId: number;
  const handler = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      onFiltersChange?.({
        activeTypes: [...activeTypes],
        activeStatuses: [...activeStatuses],
        sortOption,
        scrollTop: el.scrollTop,
      });
    });
  };

  el.addEventListener("scroll", handler, { passive: true });
  return () => {
    el.removeEventListener("scroll", handler);
    cancelAnimationFrame(rafId);
  };
}, [activeTypes, activeStatuses, sortOption, onFiltersChange]);
```

**Restoring scroll position:**

```typescript
useLayoutEffect(() => {
  const el = scrollContainerRef.current;
  if (el && initialFilters?.scrollTop) {
    el.scrollTop = initialFilters.scrollTop;
  }
}, []); // only on mount
```

---

## 8. Error Handling

Every error scenario, the exact behaviour, and which component handles it:

| # | Scenario | Handling Component | Behaviour |
|---|----------|--------------------|-----------|
| 1 | Document's Markdown file missing on disk | `DocumentViewer` | Content area shows `EmptyState` with `FileX` icon, heading "File not found", body "The file `{path}` could not be found." Metadata panel shows `DriftBadge` as "Modified since approval" (if approved) or the regular status badge; Content Hash Status shows "✗ File missing" in red. |
| 2 | Unknown `type` value on a DocumentRecord | `DocumentList`, `MetadataPanel` | Display raw string in a grey badge (`bg-gray-100 text-gray-600`). The filter bar does **not** include a toggle for it. Document is visible when no type filters are active; hidden if any type filters are active (since it cannot match any known toggle). |
| 3 | Unknown `status` value | `DriftBadge`, `DocumentList` | DriftBadge falls through to "draft" visual (grey) but displays the raw status string as the label. List badge uses grey background with raw string. |
| 4 | `content_hash` field absent | `DriftBadge`, `ContentHashStatus` | No drift warning. DriftBadge shows "Approved" (if approved). ContentHashStatus shows "— No hash recorded". |
| 5 | `title` field empty or missing | `DocumentList`, `DocumentViewer` | Fall back to the filename: `documentRecord.path.split("/").pop()`. |
| 6 | `owner` references a non-existent entity | `MetadataPanel` → `EntityLink` | Display the raw ID string. Show "(not found)" dimmed indicator. |
| 7 | Extremely large Markdown file | `MarkdownViewer` | Render as-is. No truncation. Performance is acceptable for typical documents (<1MB). |
| 8 | `readDocument()` returns a file-system error other than not-found | `document.ts` | Treated identically to "file not found". The `DocumentMissing` variant is returned. |
| 9 | Zustand store has no documents | `DocumentList` | Empty state: icon (FileText), heading "No documents", body "This project has no registered documents." |
| 10 | All documents filtered out | `DocumentList` | Empty state: icon (Filter), heading "No matches", body "No documents match the active filters." + "Clear filters" link. |
| 11 | `readResult` is `null` (still loading) | `DocumentViewer` | Content area shows `LoadingState`. Metadata panel Content Hash Status shows "— Loading…". |

---

## 9. Implementation Order

Tasks should be implemented in this order to build up from the data layer to the UI:

| Order | Component | Depends On | Rationale |
|-------|-----------|------------|-----------|
| 1 | `src/lib/constants/type-colours.ts` | Nothing | Pure data mapping; no deps |
| 2 | `src/lib/reader/document.ts` | `@tauri-apps/plugin-fs`, `DocumentRecord` type | Data layer: file I/O + SHA-256; testable in isolation |
| 3 | `src/lib/query/references.ts` (additions) | `ProjectState` types | Pure function over store; testable in isolation |
| 4 | `src/styles/markdown.css` | Nothing | Stylesheet; no code deps |
| 5 | `src/components/document/DriftBadge.tsx` | `type-colours.ts` | Small, self-contained; used by MetadataPanel |
| 6 | `src/components/document/MarkdownViewer.tsx` | `react-markdown`, plugins, `markdown.css` | Self-contained renderer; testable with raw strings |
| 7 | `src/components/document/MetadataPanel.tsx` | `DriftBadge`, `EntityLink`, `references.ts`, `type-colours.ts` | Composes several sub-components |
| 8 | `src/components/document/DocumentViewer.tsx` | `MarkdownViewer`, `MetadataPanel`, `document.ts` | Full viewer; requires data loading |
| 9 | `src/components/document/DocumentList.tsx` | `type-colours.ts`, UI store additions | Full list with filtering/sorting |
| 10 | `src/components/document/DocumentsView.tsx` | `DocumentList`, `DocumentViewer`, UI store | Container: wires list ↔ viewer navigation |

---

## 10. Acceptance Criteria

Each criterion maps to a testable statement. Implementation is complete when all are satisfied.

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | **Document list displays all registered documents** with their `title` (not filename), relative date, type badge, and status badge. | Open a project with ≥3 documents. All appear. Titles are from the `title` field, not the file path. |
| 2 | **Type filter toggles** filter correctly: OR within type, AND with status. | Activate "design" + "report" type toggles. Only design and report documents appear. Add "approved" status toggle: only approved design and report documents appear. |
| 3 | **Status filter toggles** filter correctly: OR within status, AND with type. | Activate "draft" + "approved" status toggles. Only draft and approved documents appear. |
| 4 | **No active filters = show all.** | Deactivate all toggles. Every document appears. |
| 5 | **Lozenge click** in a list row toggles the corresponding filter. | Click a "design" type badge on a list row. The "design" type toggle activates. Click it again: it deactivates. The row click does not also navigate to the viewer. |
| 6 | **Sort control** changes list order for all six options. | Select each sort option in turn. Verify the list reorders correctly. Default is "Newest first". |
| 7 | **Clicking a row** navigates to the Document Viewer. | Click a document row. The viewer opens showing the document's Markdown content and metadata. |
| 8 | **GFM rendering** correctly displays tables, task lists, strikethrough, and autolinks. | Open a document containing all four GFM features. Tables render with borders and header row. Task lists show checkboxes (disabled). Strikethrough text has a line through it. URLs are clickable links. |
| 9 | **Syntax highlighting** works in fenced code blocks with a language identifier. | Open a document with a ` ```typescript ` code block. Code is syntax-highlighted with colours. |
| 10 | **Paper-width rendering** constrains content to ~700px max-width. | On a wide screen, the Markdown content column does not exceed 700px. |
| 11 | **Heading anchors** are generated. | Inspect the rendered HTML. Each `h1`–`h6` has an `id` attribute with the slugified heading text. |
| 12 | **Metadata panel** displays all seven fields in order: Status (DriftBadge), Filename, Type, Owner, Related Entities, Superseded By, Content Hash Status. | Open any document viewer. All fields are visible in the right sidebar in the specified order. |
| 13 | **Drift detection: approved + matching hash** → green "Approved" badge. | Open an approved document whose file has not been modified. Badge is green with "Approved". |
| 14 | **Drift detection: approved + different hash** → orange "Modified since approval" badge. | Modify an approved document's file on disk. Reopen in KBZV. Badge is orange with "Modified since approval". |
| 15 | **Drift detection: no hash recorded** → no warning. | Open an approved document that has no `content_hash` field. Badge shows green "Approved" (no warning). Content Hash Status shows "— No hash recorded". |
| 16 | **Missing file handling** → content area shows "File not found"; metadata shows appropriate indicators. | Delete a document's Markdown file from disk. Open that document. Content area shows the file-not-found empty state. Content Hash Status shows "✗ File missing" in red. |
| 17 | **Back button** returns to the document list with scroll position and filter state preserved. | Scroll down in the list, activate a filter, open a document, click Back. The list shows the same filters and approximate scroll position. |
| 18 | **Empty state: no documents** displays the correct message. | Open a project with zero registered documents. The "No documents" empty state appears. |
| 19 | **Empty state: all filtered out** displays the correct message with a "Clear filters" link. | Activate a type filter that matches no documents. The "No matches" empty state appears. Click "Clear filters": all documents reappear. |
| 20 | **Unknown status/type values** render as grey badges with the raw string and do not crash. | Manually create a document record with `type: "custom-thing"` and `status: "unknown-state"`. Both render as grey badges displaying the raw strings. No errors in the console. |
| 21 | **EntityLink in metadata panel** is rendered but inert in F4. | Click on the Owner entity link in the metadata panel. Nothing happens (no navigation, no error). |
| 22 | **SHA-256 matches Kanbanzai's computation.** | Run `kbz doc approve` on a document. Open it in KBZV. The "Content verified" status appears. The hex digests match. |

### Checklist

- [ ] Document list renders all registered documents with title, relative date, type badge, and status badge
- [ ] Type filter toggles correctly include/exclude documents by type (OR within type, AND with status)
- [ ] Status filter toggles correctly include/exclude documents by status (OR within status, AND with type)
- [ ] All toggles inactive shows all documents
- [ ] Clicking a type/status lozenge in a list row activates the corresponding filter
- [ ] Sort control reorders the list for all six sort options (default: Newest first)
- [ ] Clicking a document row opens the Document Viewer showing Markdown content and metadata
- [ ] GFM rendering: tables, task lists, strikethrough, and autolinks render correctly
- [ ] Syntax highlighting works in fenced code blocks with a language identifier
- [ ] Markdown content is constrained to ~700px max-width (paper-width)
- [ ] Heading anchors are generated (each h1–h6 has a slugified id attribute)
- [ ] Metadata panel shows all seven fields in specified order: Status, Filename, Type, Owner, Related Entities, Superseded By, Content Hash Status
- [ ] Drift detection: approved + matching hash shows green "Approved" badge
- [ ] Drift detection: approved + different hash shows orange "Modified since approval" badge
- [ ] Missing file shows "File not found" content area and "File missing" metadata indicator
- [ ] Back button returns to document list with scroll position and filter state preserved
- [ ] Empty state shown when no documents are registered
- [ ] Empty state with "Clear filters" shown when all documents are filtered out
- [ ] Unknown status/type values render as grey badges without crashing
- [ ] EntityLink in metadata panel is rendered but inert (no navigation) in F4
- [ ] SHA-256 content hash matches Kanbanzai's recorded hash for approved documents
- [ ] readDocumentContent() reads file content, computes SHA-256, and returns DocumentContent or DocumentMissing
- [ ] DriftBadge resolves to one of four states: approved-clean, approved-modified, draft, superseded
- [ ] DocumentsView container manages selected document and filter state
- [ ] Scroll position is preserved when returning from viewer to list