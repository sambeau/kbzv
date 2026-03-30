# F4: Documents View — Development Plan

| Field       | Value                                      |
|-------------|--------------------------------------------|
| Feature ID  | FEAT-01KMZA9JMZFNF                        |
| Parent Plan | P1-kbzv                                    |
| Depends On  | FEAT-01KMZA96W1J98 (F1), FEAT-01KMZA9CP9XEX (F2) |
| Type        | Dev Plan                                   |
| Status      | Draft                                      |

**Source spec:** `work/spec/f4-documents-view-spec.md`
**Source design:** `work/design/f4-documents-view.md`
**Architecture reference:** `work/design/kbzv-architecture.md` §6.4–6.5, §7, §8

---

## Task Dependency Graph

```
T1 npm deps
│
├──→ T3 MarkdownViewer ──→ T10 markdown.css ──┐
│                                               │
T2 document reader ───────────────────────────→ T8 DocumentViewer ──→ T9 DocumentsView
│                                               │
T4 DriftBadge ──→ T7 MetadataPanel ───────────┘
│                                               │
T5 DocumentList ───────────────────────────────┘
│
T6 Filter Bar ──→ T5 (integrated)
```

Linearised implementation order:

```
T1  →  T2  →  T4  →  T10  →  T3  →  T6  →  T5  →  T7  →  T8  →  T9
```

---

## T1: Install npm Dependencies

**Estimated effort:** 0.5 points

### What to do

Install the four Markdown rendering packages and the highlight.js peer dependency. These are required before any Markdown component work can begin.

### Implementation

```bash
pnpm add react-markdown@^9.0.0 remark-gfm@^4.0.0 rehype-highlight@^7.0.0 rehype-sanitize@^6.0.0 highlight.js@^11.9.0
```

### Files touched

| File | Action |
|------|--------|
| `package.json` | Modified — five new dependencies |
| `pnpm-lock.yaml` | Modified — lockfile update |

### Dependencies

- F1 complete (project scaffold exists with `package.json`)

### Verification

```bash
# All packages resolve and the app still compiles
pnpm install
pnpm run build

# Verify packages are importable
pnpm exec node -e "require('react-markdown'); require('remark-gfm'); require('rehype-highlight'); require('rehype-sanitize'); console.log('OK')"
```

---

## T2: Document Content Reader

**Estimated effort:** 3 points

### What to do

Create `src/lib/reader/document.ts` — the data-layer module that reads a Markdown file from disk via Tauri's FS plugin, computes a SHA-256 content hash using the Web Crypto API, and compares the hash against the document record's stored `content_hash` for drift detection. Also create `src/lib/constants/type-colours.ts` with the document-type colour mapping.

### Implementation

**`src/lib/reader/document.ts`:**

```typescript
import { readTextFile } from "@tauri-apps/plugin-fs";
import type { DocumentRecord } from "../types/document";

// --- Public Types ---

export interface DocumentContent {
  markdown: string;
  contentHash: string;
  hashMatches: boolean;
  fileMissing: false;
}

export interface DocumentMissing {
  markdown: null;
  contentHash: null;
  hashMatches: false;
  fileMissing: true;
}

export type DocumentReadResult = DocumentContent | DocumentMissing;

// --- Internal ---

async function computeSHA256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- Public API ---

export async function readDocument(
  projectPath: string,
  documentRecord: DocumentRecord
): Promise<DocumentReadResult> {
  const fullPath = `${projectPath}/${documentRecord.path}`;

  let content: string;
  try {
    content = await readTextFile(fullPath);
  } catch {
    // File not found or other FS error — return the missing variant.
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
```

**Key design decisions:**
- `readTextFile` from `@tauri-apps/plugin-fs` is the only FS access method (Tauri sandbox).
- `TextEncoder.encode()` produces the same UTF-8 byte sequence as Go's `crypto/sha256`, so hex digests match kanbanzai exactly.
- All FS errors are treated as "file missing" — we cannot meaningfully distinguish `ENOENT` from `EACCES` in the Tauri plugin.
- When `content_hash` is absent on the record, `hashMatches` is `true` (no warning for pre-approval documents).

**`src/lib/constants/type-colours.ts`:**

```typescript
export interface TypeColour {
  bg: string;
  text: string;
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

**`src/lib/query/references.ts` (additions):**

Add the `getRelatedEntities` export to the existing references module:

```typescript
import type { ProjectState } from "../store/project-store";

export interface RelatedEntity {
  id: string;
  type: "plan" | "feature";
  summary: string;
}

export function getRelatedEntities(
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

### Files touched

| File | Action |
|------|--------|
| `src/lib/reader/document.ts` | **New** |
| `src/lib/constants/type-colours.ts` | **New** |
| `src/lib/query/references.ts` | **Modified** — add `getRelatedEntities()` |

### Dependencies

- T1 (npm deps installed)
- F2 complete (`DocumentRecord` type, `@tauri-apps/plugin-fs`, Zustand store with `projectPath`)

### Verification

1. **Unit test — hash computation:**
   ```typescript
   // The empty string should produce the well-known SHA-256 hash
   const hash = await computeSHA256("");
   expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
   ```

2. **Unit test — hash match detection:**
   ```typescript
   const mockRecord = { path: "test.md", content_hash: "abc123" } as DocumentRecord;
   // readDocument should return hashMatches: false when hash differs
   ```

3. **Unit test — missing content_hash treated as clean:**
   ```typescript
   const mockRecord = { path: "test.md" } as DocumentRecord; // no content_hash
   // readDocument should return hashMatches: true
   ```

4. **Integration — SHA-256 matches kanbanzai:**
   ```bash
   # Approve a document with kbz, then compare hex digests
   kbz doc approve <doc-id>
   # Open in KBZV — "Content verified" should appear
   ```

5. **Type colours — coverage:**
   ```typescript
   expect(getTypeColour("design").bg).toBe("bg-blue-100");
   expect(getTypeColour("unknown-thing").bg).toBe("bg-gray-100");
   ```

---

## T3: MarkdownViewer Component

**Estimated effort:** 5 points

### What to do

Create `src/components/document/MarkdownViewer.tsx` — a pure presentation component that accepts a raw Markdown string and renders it as styled HTML using `react-markdown` with GFM, syntax highlighting, XSS sanitization, custom heading anchors, and external link handling.

### Implementation

**`src/components/document/MarkdownViewer.tsx`:**

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Components } from "react-markdown";

import "../../styles/markdown.css";

// --- Props ---

interface MarkdownViewerProps {
  content: string;
}

// --- Sanitize schema ---
// Extend the default to allow highlight.js class names on code/pre/span elements.
// rehypeHighlight must come BEFORE rehypeSanitize in the plugin array so that
// class names exist when the sanitizer runs.

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

// --- Heading anchor generation ---

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getTextContent(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(getTextContent).join("");
  if (children && typeof children === "object" && "props" in children) {
    return getTextContent((children as React.ReactElement).props.children);
  }
  return "";
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

// --- Custom component overrides ---

const customComponents: Components = {
  h1: createHeadingComponent(1),
  h2: createHeadingComponent(2),
  h3: createHeadingComponent(3),
  h4: createHeadingComponent(4),
  h5: createHeadingComponent(5),
  h6: createHeadingComponent(6),

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

  img: ({ src, alt, ...props }) => (
    <img
      src={src}
      alt={alt ?? ""}
      className="max-w-full h-auto rounded"
      loading="lazy"
      {...props}
    />
  ),

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

// --- Component ---

export function MarkdownViewer({ content }: MarkdownViewerProps) {
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

**Key design decisions:**
- **Plugin order matters:** `rehypeHighlight` before `rehypeSanitize` so syntax highlighting classes survive sanitization.
- **Paper-width:** `max-w-[700px]` on the outer wrapper constrains to comfortable reading width.
- **Pure component:** No state, no data fetching. Receives a string, returns styled HTML.
- **External links:** All `<a>` tags get `target="_blank" rel="noopener noreferrer"`.
- **Disabled checkboxes:** GFM task lists render with read-only checkbox inputs.

### Files touched

| File | Action |
|------|--------|
| `src/components/document/MarkdownViewer.tsx` | **New** |

### Dependencies

- T1 (npm deps: `react-markdown`, `remark-gfm`, `rehype-highlight`, `rehype-sanitize`)
- T10 (Markdown CSS theme — can be developed in parallel, but must exist before visual verification)

### Verification

1. **Render test — basic Markdown:**
   Pass a string containing `# Hello\n\nParagraph text.` and verify an `<h1 id="hello">` element is rendered with the paragraph below it.

2. **GFM features test:**
   Render a string with a pipe table, `- [x] Done`, `~~struck~~`, and `https://example.com`. Verify:
   - Table renders with `<table>` / `<th>` / `<td>` elements
   - Task list checkbox is present and disabled
   - Strikethrough has a `<del>` element
   - URL is wrapped in `<a>` with `target="_blank"`

3. **Syntax highlighting test:**
   Render a fenced code block with ` ```typescript `. Verify the rendered `<code>` element contains `hljs-*` class names on child `<span>` elements.

4. **Heading anchor test:**
   Render `## 2.1 Data Model`. Verify the `<h2>` element has `id="21-data-model"`.

5. **Paper width test:**
   Mount the component in a 1200px-wide container. Verify the Markdown content does not exceed 700px wide.

6. **XSS sanitization test:**
   Render a string containing `<script>alert('xss')</script>`. Verify no `<script>` element exists in the output DOM.

---

## T4: DriftBadge Component

**Estimated effort:** 2 points

### What to do

Create `src/components/document/DriftBadge.tsx` — a badge component that combines a document's status with drift-detection hash comparison to produce one of four visual states: approved-clean, approved-modified, draft, or superseded.

### Implementation

**`src/components/document/DriftBadge.tsx`:**

```tsx
import { CheckCircle, AlertTriangle, FileEdit, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// --- Props ---

export interface DriftBadgeProps {
  status: string;
  contentHashExpected?: string;
  contentHashActual?: string;
  fileMissing?: boolean;
}

// --- State resolution ---

type DriftState = "approved-clean" | "approved-modified" | "draft" | "superseded";

function resolveDriftState(props: DriftBadgeProps): DriftState {
  if (props.status === "superseded") return "superseded";
  if (props.status === "draft") return "draft";
  if (props.status === "approved") {
    if (props.fileMissing) return "approved-modified";
    if (!props.contentHashExpected) return "approved-clean";
    if (props.contentHashActual === props.contentHashExpected) return "approved-clean";
    return "approved-modified";
  }
  // Unknown status — treat as draft-like (grey)
  return "draft";
}

// --- Visual config ---

const DRIFT_VISUALS: Record<
  DriftState,
  {
    label?: string;
    bg: string;
    text: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  "approved-clean": {
    label: "Approved",
    bg: "bg-green-100",
    text: "text-green-800",
    Icon: CheckCircle,
  },
  "approved-modified": {
    label: "Modified since approval",
    bg: "bg-orange-100",
    text: "text-orange-800",
    Icon: AlertTriangle,
  },
  draft: {
    label: "Draft",
    bg: "bg-gray-100",
    text: "text-gray-600",
    Icon: FileEdit,
  },
  superseded: {
    label: "Superseded",
    bg: "bg-purple-100",
    text: "text-purple-800",
    Icon: Archive,
  },
};

// --- Component ---

export function DriftBadge(props: DriftBadgeProps) {
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

**State resolution truth table:**

| status | fileMissing | contentHashExpected | contentHashActual | → DriftState |
|--------|-------------|---------------------|-------------------|--------------|
| `superseded` | any | any | any | `superseded` |
| `draft` | any | any | any | `draft` |
| `approved` | `true` | any | any | `approved-modified` |
| `approved` | `false` | absent | any | `approved-clean` |
| `approved` | `false` | `"abc"` | `"abc"` | `approved-clean` |
| `approved` | `false` | `"abc"` | `"def"` | `approved-modified` |
| `"custom"` | any | any | any | `draft` (shows raw string) |

### Files touched

| File | Action |
|------|--------|
| `src/components/document/DriftBadge.tsx` | **New** |

### Dependencies

- F1 complete (shadcn `Badge` component, `cn` utility, Lucide icons)

### Verification

1. **Unit test — state resolution for all 4 states:**
   ```typescript
   expect(resolveDriftState({ status: "approved", contentHashExpected: "a", contentHashActual: "a" }))
     .toBe("approved-clean");
   expect(resolveDriftState({ status: "approved", contentHashExpected: "a", contentHashActual: "b" }))
     .toBe("approved-modified");
   expect(resolveDriftState({ status: "draft" })).toBe("draft");
   expect(resolveDriftState({ status: "superseded" })).toBe("superseded");
   ```

2. **Unit test — unknown status shows raw string:**
   ```typescript
   // Render DriftBadge with status="pending-review"
   // Verify the badge text content is "pending-review" (not "Draft")
   ```

3. **Unit test — approved with no hash is clean:**
   ```typescript
   expect(resolveDriftState({ status: "approved" })).toBe("approved-clean");
   ```

4. **Unit test — approved with missing file is modified:**
   ```typescript
   expect(resolveDriftState({ status: "approved", fileMissing: true })).toBe("approved-modified");
   ```

5. **Visual check:** Mount each of the four badge variants and verify colours and icons match the spec table.

---

## T5: DocumentList Component

**Estimated effort:** 5 points

### What to do

Create `src/components/document/DocumentList.tsx` — the filterable, sortable list of all registered documents. Each row is a clickable card showing title, relative date, type badge, and status badge. Integrates the filter bar (T6), sort control, badge-click-to-filter shortcut, and both empty state variants.

### Implementation

**`src/components/document/DocumentList.tsx`:**

```tsx
import { useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { FileText, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/lib/store/project-store";
import { getTypeColour } from "@/lib/constants/type-colours";
import { EmptyState } from "@/components/common/EmptyState";
import { DocumentFilterBar } from "./DocumentFilterBar";
import type { DocumentRecord } from "@/lib/types/document";

// --- Types ---

export type SortOption =
  | "newest"
  | "oldest"
  | "title-asc"
  | "title-desc"
  | "type"
  | "status";

export interface DocumentListFilters {
  activeTypes: string[];
  activeStatuses: string[];
  sortOption: SortOption;
  scrollTop: number;
}

interface DocumentListProps {
  onSelect: (documentId: string) => void;
  initialFilters?: DocumentListFilters;
  onFiltersChange?: (filters: DocumentListFilters) => void;
}

// --- Constants ---

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
  { value: "type", label: "Type" },
  { value: "status", label: "Status" },
];

const DEFAULT_SORT: SortOption = "newest";

// --- Status colours ---

const STATUS_COLOURS: Record<string, { bg: string; text: string }> = {
  approved: { bg: "bg-green-100", text: "text-green-800" },
  draft: { bg: "bg-gray-100", text: "text-gray-600" },
  superseded: { bg: "bg-purple-100", text: "text-purple-800" },
};

const UNKNOWN_STATUS_COLOUR = { bg: "bg-gray-100", text: "text-gray-600" };

function getStatusColour(status: string) {
  return STATUS_COLOURS[status] ?? UNKNOWN_STATUS_COLOUR;
}

// --- Sort ---

function sortDocuments(docs: DocumentRecord[], option: SortOption): DocumentRecord[] {
  return [...docs].sort((a, b) => {
    switch (option) {
      case "newest":
        return b.updated.localeCompare(a.updated);
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

// --- Filter ---

function filterDocuments(
  docs: DocumentRecord[],
  activeTypes: Set<string>,
  activeStatuses: Set<string>
): DocumentRecord[] {
  return docs.filter((doc) => {
    const matchesType = activeTypes.size === 0 || activeTypes.has(doc.type);
    const matchesStatus = activeStatuses.size === 0 || activeStatuses.has(doc.status);
    return matchesType && matchesStatus;
  });
}

// --- Relative date helper ---

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? "s" : ""} ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? "s" : ""} ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? "s" : ""} ago`;
}

// --- Component ---

export function DocumentList({ onSelect, initialFilters, onFiltersChange }: DocumentListProps) {
  const documents = useProjectStore((s) => s.documents);

  const [activeTypes, setActiveTypes] = useState<Set<string>>(
    new Set(initialFilters?.activeTypes ?? [])
  );
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(
    new Set(initialFilters?.activeStatuses ?? [])
  );
  const [sortOption, setSortOption] = useState<SortOption>(
    initialFilters?.sortOption ?? DEFAULT_SORT
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // --- Derived data ---

  const allDocs = useMemo(() => Array.from(documents.values()), [documents]);
  const filtered = useMemo(
    () => filterDocuments(allDocs, activeTypes, activeStatuses),
    [allDocs, activeTypes, activeStatuses]
  );
  const sorted = useMemo(() => sortDocuments(filtered, sortOption), [filtered, sortOption]);

  // --- Scroll position preservation ---

  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (el && initialFilters?.scrollTop) {
      el.scrollTop = initialFilters.scrollTop;
    }
  }, []);

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

  // --- Filter change propagation ---

  useEffect(() => {
    onFiltersChange?.({
      activeTypes: [...activeTypes],
      activeStatuses: [...activeStatuses],
      sortOption,
      scrollTop: scrollContainerRef.current?.scrollTop ?? 0,
    });
  }, [activeTypes, activeStatuses, sortOption]);

  // --- Badge click handlers ---

  function handleTypeBadgeClick(e: React.MouseEvent, type: string) {
    e.stopPropagation();
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function handleStatusBadgeClick(e: React.MouseEvent, status: string) {
    e.stopPropagation();
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  function clearAllFilters() {
    setActiveTypes(new Set());
    setActiveStatuses(new Set());
  }

  // --- Render ---

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar + sort */}
      <DocumentFilterBar
        activeTypes={activeTypes}
        activeStatuses={activeStatuses}
        sortOption={sortOption}
        onTypesChange={setActiveTypes}
        onStatusesChange={setActiveStatuses}
        onSortChange={setSortOption}
      />

      {/* Document list */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {sorted.length > 0 ? (
          sorted.map((doc) => {
            const typeColour = getTypeColour(doc.type);
            const statusColour = getStatusColour(doc.status);
            const displayTitle = doc.title || doc.path.split("/").pop() || doc.path;

            return (
              <button
                key={doc.id}
                onClick={() => onSelect(doc.id)}
                className="flex items-start justify-between w-full rounded-lg border
                  border-border bg-card px-4 py-3 text-left transition-colors
                  hover:bg-accent hover:text-accent-foreground cursor-pointer
                  focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-3">
                  <span className="text-sm font-medium leading-tight truncate">
                    {displayTitle}
                  </span>
                  <Tooltip content={doc.updated}>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeDate(doc.updated)}
                    </span>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  <Badge
                    variant="secondary"
                    className={cn(typeColour.bg, typeColour.text, "border-0 font-normal cursor-pointer")}
                    onClick={(e) => handleTypeBadgeClick(e, doc.type)}
                  >
                    {doc.type}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={cn(statusColour.bg, statusColour.text, "border-0 font-normal cursor-pointer")}
                    onClick={(e) => handleStatusBadgeClick(e, doc.status)}
                  >
                    {doc.status}
                  </Badge>
                </div>
              </button>
            );
          })
        ) : allDocs.length === 0 ? (
          <EmptyState
            icon={FileText}
            heading="No documents"
            body="This project has no registered documents."
          />
        ) : (
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
        )}
      </div>
    </div>
  );
}
```

### Files touched

| File | Action |
|------|--------|
| `src/components/document/DocumentList.tsx` | **New** |

### Dependencies

- T2 (type-colours.ts)
- T6 (DocumentFilterBar — can be built as part of T5 or as a sub-component; see T6)
- F1 (shadcn Badge, Button, Select, Tooltip, EmptyState)
- F2 (Zustand project store with `documents` map)

### Verification

1. **Render test — displays all documents:**
   Populate the store with 5 mock documents. Mount `DocumentList`. Verify 5 rows render, each showing the title, relative date, type badge, and status badge.

2. **Title fallback:**
   Create a document record with an empty `title`. Verify the row displays the filename from `path`.

3. **Default sort is newest first:**
   Create documents with different `updated` dates. Mount without `initialFilters`. Verify the order is newest first.

4. **Sort control works:**
   Change sort to "Title A–Z". Verify list reorders alphabetically.

5. **Row click navigates:**
   Click a document row. Verify `onSelect` is called with the correct document ID.

6. **Badge click toggles filter:**
   Click a "design" type badge. Verify only design documents remain visible. Click again — all reappear.

7. **Empty state — no documents:**
   Mount with an empty store. Verify "No documents" empty state.

8. **Empty state — all filtered out:**
   Activate a type filter that matches nothing. Verify "No matches" with "Clear filters" link.

---

## T6: Document Filter Bar

**Estimated effort:** 3 points

### What to do

Create `src/components/document/DocumentFilterBar.tsx` — the filter bar with type toggles (6 known types), status toggles (3 statuses with colour dots), and the sort dropdown. Sits above the document list. Uses shadcn `ToggleGroup` for type/status toggles and `Select` for the sort control.

### Implementation

**`src/components/document/DocumentFilterBar.tsx`:**

```tsx
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SortOption } from "./DocumentList";

// --- Constants ---

const KNOWN_DOC_TYPES = [
  "design",
  "specification",
  "dev-plan",
  "research",
  "report",
  "policy",
] as const;

const STATUS_TOGGLES = [
  { value: "approved", label: "Approved", colour: "#22C55E" },
  { value: "draft", label: "Draft", colour: "#9CA3AF" },
  { value: "superseded", label: "Superseded", colour: "#A855F7" },
] as const;

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
  { value: "type", label: "Type" },
  { value: "status", label: "Status" },
];

// --- Props ---

interface DocumentFilterBarProps {
  activeTypes: Set<string>;
  activeStatuses: Set<string>;
  sortOption: SortOption;
  onTypesChange: (types: Set<string>) => void;
  onStatusesChange: (statuses: Set<string>) => void;
  onSortChange: (sort: SortOption) => void;
}

// --- Component ---

export function DocumentFilterBar({
  activeTypes,
  activeStatuses,
  sortOption,
  onTypesChange,
  onStatusesChange,
  onSortChange,
}: DocumentFilterBarProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-border shrink-0 flex-wrap">
      {/* Type filters */}
      <ToggleGroup
        type="multiple"
        value={[...activeTypes]}
        onValueChange={(values) => onTypesChange(new Set(values))}
      >
        {KNOWN_DOC_TYPES.map((t) => (
          <ToggleGroupItem key={t} value={t} size="sm" className="text-xs">
            {t}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Separator orientation="vertical" className="h-5" />

      {/* Status filters */}
      <ToggleGroup
        type="multiple"
        value={[...activeStatuses]}
        onValueChange={(values) => onStatusesChange(new Set(values))}
      >
        {STATUS_TOGGLES.map((s) => (
          <ToggleGroupItem key={s.value} value={s.value} size="sm" className="text-xs">
            <span
              className="mr-1 inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: s.colour }}
            />
            {s.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {/* Sort — pushed right */}
      <div className="ml-auto">
        <Select value={sortOption} onValueChange={(v) => onSortChange(v as SortOption)}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
```

**Filter logic (AND across categories, OR within):**
- No active types = no type restriction (all types shown).
- No active statuses = no status restriction (all statuses shown).
- When both have active values: document must match at least one active type AND at least one active status.
- Note: `rca` type is valid but omitted from the filter bar toggles (rare). Documents with `rca` or unknown types still appear when no type filter is active, and are hidden when any type filters are active (since they cannot match a known toggle).

### Files touched

| File | Action |
|------|--------|
| `src/components/document/DocumentFilterBar.tsx` | **New** |

### Dependencies

- F1 (shadcn ToggleGroup, Select, Separator)
- T5 (shares `SortOption` type definition)

### Verification

1. **Type toggles activate and deactivate:**
   Click "design" toggle — it becomes pressed. Click again — it deactivates.

2. **Multiple type selection:**
   Activate "design" and "report". Verify both are in the pressed state.

3. **Status toggles with colour dots:**
   Verify each status toggle shows the correct colour indicator dot.

4. **Sort dropdown:**
   Open the sort dropdown. Verify all 6 options are present. Select "Title A–Z". Verify `onSortChange` fires with `"title-asc"`.

5. **AND logic integration:**
   Activate type "design" and status "approved". Verify the parent list only shows documents matching both criteria.

---

## T7: MetadataPanel Component

**Estimated effort:** 5 points

### What to do

Create `src/components/document/MetadataPanel.tsx` — the right sidebar in the Document Viewer that displays all seven metadata fields in order: Status (DriftBadge), Filename, Type, Owner, Related Entities, Superseded By, and Content Hash Status. Also wire in the `getRelatedEntities()` reverse lookup from T2.

### Implementation

**`src/components/document/MetadataPanel.tsx`:**

```tsx
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/lib/store/project-store";
import { DriftBadge } from "./DriftBadge";
import { getTypeColour } from "@/lib/constants/type-colours";
import { getRelatedEntities } from "@/lib/query/references";
import type { DocumentRecord } from "@/lib/types/document";
import type { DocumentReadResult } from "@/lib/reader/document";

// --- Props ---

interface MetadataPanelProps {
  record: DocumentRecord;
  readResult: DocumentReadResult | null;
}

// --- Field section wrapper ---

function MetadataField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

// --- TypeBadge ---

function TypeBadge({ type }: { type: string }) {
  const colour = getTypeColour(type);
  return (
    <Badge variant="secondary" className={cn(colour.bg, colour.text, "border-0 font-normal")}>
      {type}
    </Badge>
  );
}

// --- EntityLink (inert in F4, wired in F5) ---

function EntityLink({ entityId, subtitle }: { entityId: string; subtitle?: string }) {
  return (
    <span className="text-sm">
      <span className="text-foreground">{entityId}</span>
      {subtitle && (
        <span className="text-xs text-muted-foreground ml-1">{subtitle}</span>
      )}
    </span>
  );
}

// --- Content hash status ---

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

// --- Component ---

export function MetadataPanel({ record, readResult }: MetadataPanelProps) {
  const relatedEntities = useProjectStore((state) =>
    getRelatedEntities(record.id, state)
  );

  return (
    <div className="px-4 py-4 space-y-5">
      {/* 1. Status (with drift) */}
      <MetadataField label="Status">
        <DriftBadge
          status={record.status}
          contentHashExpected={record.content_hash}
          contentHashActual={
            readResult && !readResult.fileMissing ? readResult.contentHash : undefined
          }
          fileMissing={readResult?.fileMissing ?? false}
        />
      </MetadataField>

      {/* 2. Filename */}
      <MetadataField label="Filename">
        <span className="text-xs text-muted-foreground font-mono break-all">
          {record.path}
        </span>
      </MetadataField>

      {/* 3. Type */}
      <MetadataField label="Type">
        <TypeBadge type={record.type} />
      </MetadataField>

      {/* 4. Owner */}
      <MetadataField label="Owner">
        {record.owner ? (
          <EntityLink entityId={record.owner} />
        ) : (
          <span className="text-sm text-muted-foreground">(none)</span>
        )}
      </MetadataField>

      {/* 5. Related Entities */}
      <MetadataField label="Related Entities">
        {relatedEntities.length > 0 ? (
          <div className="space-y-1">
            {relatedEntities.map((entity) => (
              <div key={entity.id}>
                <EntityLink entityId={entity.id} subtitle={entity.summary} />
              </div>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">(none)</span>
        )}
      </MetadataField>

      {/* 6. Superseded By */}
      <MetadataField label="Superseded By">
        {record.superseded_by ? (
          <EntityLink entityId={record.superseded_by} />
        ) : (
          <span className="text-sm text-muted-foreground">(none)</span>
        )}
        {record.supersedes && (
          <div className="mt-1">
            <span className="text-xs text-muted-foreground">Supersedes: </span>
            <EntityLink entityId={record.supersedes} />
          </div>
        )}
      </MetadataField>

      {/* 7. Content Hash Status */}
      <MetadataField label="Content Hash">
        <ContentHashStatus record={record} readResult={readResult} />
      </MetadataField>
    </div>
  );
}
```

**Key design decisions:**
- `EntityLink` is rendered as an inert `<span>` in F4 (no navigation, no `cursor-pointer`). F5 will replace with a `<button>` that navigates to the Workflows view.
- `getRelatedEntities` does a linear scan of plans and features — acceptable for typical project sizes (<100 plans, <500 features).
- If `readResult` is null (still loading), the DriftBadge receives no hash data and the Content Hash Status shows "Loading…".

### Files touched

| File | Action |
|------|--------|
| `src/components/document/MetadataPanel.tsx` | **New** |

### Dependencies

- T2 (type-colours.ts, references.ts `getRelatedEntities`)
- T4 (DriftBadge component)
- F1 (shadcn Badge, Tooltip)
- F2 (Zustand store with plans, features, documents)

### Verification

1. **All 7 fields render in order:**
   Mount with a complete `DocumentRecord` and a `DocumentContent` read result. Verify all field labels appear in the spec order: Status, Filename, Type, Owner, Related Entities, Superseded By, Content Hash.

2. **DriftBadge receives correct props:**
   Mount with an approved document whose hash matches. Verify green "Approved" badge.

3. **Missing owner shows "(none)":**
   Mount with a record where `owner` is undefined. Verify the Owner field shows "(none)".

4. **Related entities display:**
   Set up a store where a feature's `design` field references this document. Verify the Related Entities section shows that feature's ID and summary.

5. **Content hash status — all 4 variants:**
   - Hash matches → "✓ Content verified"
   - Hash differs → "⚠ Content modified"
   - No hash recorded → "— No hash recorded"
   - File missing → "✗ File missing"

6. **Supersedes chain:**
   Mount with `superseded_by` and `supersedes` both set. Verify both references render.

---

## T8: DocumentViewer Component

**Estimated effort:** 3 points

### What to do

Create `src/components/document/DocumentViewer.tsx` — the viewer layout with a back button + title header, the Markdown content area (left), and the metadata sidebar (right). Calls `readDocument()` on mount to load file content and compute drift.

### Implementation

**`src/components/document/DocumentViewer.tsx`:**

```tsx
import { useState, useEffect } from "react";
import { ChevronLeft, FileX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/lib/store/project-store";
import { readDocument } from "@/lib/reader/document";
import { MarkdownViewer } from "./MarkdownViewer";
import { MetadataPanel } from "./MetadataPanel";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import type { DocumentReadResult } from "@/lib/reader/document";

// --- Props ---

interface DocumentViewerProps {
  documentId: string;
  onBack: () => void;
}

// --- Component ---

export function DocumentViewer({ documentId, onBack }: DocumentViewerProps) {
  const [readResult, setReadResult] = useState<DocumentReadResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const record = useProjectStore((s) => s.documents.get(documentId));
  const projectPath = useProjectStore((s) => s.projectPath);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

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

    return () => {
      cancelled = true;
    };
  }, [documentId, record, projectPath]);

  if (!record) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <EmptyState
          icon={FileX}
          heading="Document not found"
          body={`No document record with ID "${documentId}" exists.`}
        />
        <Button variant="ghost" size="sm" onClick={onBack} className="mt-4">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>
    );
  }

  const displayTitle = record.title || record.path.split("/").pop() || record.path;

  return (
    <div className="flex flex-col h-full">
      {/* Viewer header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-lg font-semibold truncate">{displayTitle}</h1>
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
  );
}
```

**Key design decisions:**
- **Cancellation pattern:** The `useEffect` uses a `cancelled` flag to prevent stale state updates if the user navigates away before loading completes.
- **Sidebar-15 pattern:** Content area fills available width (`flex-1`) beside a fixed-width 260px sidebar.
- **Independent scrolling:** Both the content area and the metadata sidebar scroll independently (`overflow-y-auto` on each).
- **Record-not-found guard:** If the document record doesn't exist in the store, an error state is shown instead of crashing.

### Files touched

| File | Action |
|------|--------|
| `src/components/document/DocumentViewer.tsx` | **New** |

### Dependencies

- T2 (document.ts reader)
- T3 (MarkdownViewer)
- T7 (MetadataPanel)
- F1 (shadcn Button, EmptyState, LoadingState)
- F2 (Zustand store with documents map and projectPath)

### Verification

1. **Loading state:**
   Mount with a document ID. Verify "Loading document…" appears briefly before content renders.

2. **Content renders:**
   After loading, verify the Markdown content appears in the left area.

3. **Metadata sidebar:**
   Verify the MetadataPanel renders in the right sidebar with all fields.

4. **File not found:**
   Point to a document whose file doesn't exist on disk. Verify "File not found" message in the content area.

5. **Record not found:**
   Pass a non-existent document ID. Verify the "Document not found" error state.

6. **Back button:**
   Click the back button. Verify `onBack` is called.

7. **Sidebar width:**
   Verify the metadata sidebar is 260px wide and does not collapse.

---

## T9: DocumentsView Container

**Estimated effort:** 2 points

### What to do

Create `src/components/document/DocumentsView.tsx` — the top-level container component that switches between the document list and document viewer. Stores filter/sort/scroll state in the Zustand UI store for preservation across viewer visits.

### Implementation

**UI store additions in `src/lib/store/ui-store.ts`:**

```typescript
// Add to the UIState interface:
interface UIState {
  // ... existing fields ...

  documentListFilters: DocumentListFilters;
  setDocumentListFilters: (filters: DocumentListFilters) => void;
}

// Add to the store creator:
documentListFilters: {
  activeTypes: [],
  activeStatuses: [],
  sortOption: "newest",
  scrollTop: 0,
},
setDocumentListFilters: (filters) => set({ documentListFilters: filters }),
```

**`src/components/document/DocumentsView.tsx`:**

```tsx
import { useState } from "react";
import { useUIStore } from "@/lib/store/ui-store";
import { DocumentList } from "./DocumentList";
import { DocumentViewer } from "./DocumentViewer";

export function DocumentsView() {
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

**Key design decisions:**
- **Conditional rendering (not `display: none`):** The list and viewer are not simultaneously mounted. State preservation is achieved through the Zustand UI store, keeping the DOM lightweight.
- **`DocumentListFilters` uses arrays (not Sets):** Zustand serialises to JSON; `Set` is not JSON-friendly. Conversion to `Set` happens inside `DocumentList`.
- **`selectedDocId` is local state:** It doesn't need to persist across view switches (the parent App handles view tabs).

### Files touched

| File | Action |
|------|--------|
| `src/components/document/DocumentsView.tsx` | **New** |
| `src/lib/store/ui-store.ts` | **Modified** — add `documentListFilters` and `setDocumentListFilters` |

### Dependencies

- T5 (DocumentList)
- T8 (DocumentViewer)
- F1 (ui-store.ts exists)

### Verification

1. **List renders by default:**
   Mount `DocumentsView`. Verify the `DocumentList` is displayed.

2. **Click row → opens viewer:**
   Click a document row. Verify the `DocumentViewer` replaces the list.

3. **Back button → returns to list:**
   From the viewer, click Back. Verify the list reappears.

4. **Filter state preserved:**
   Activate a type filter, open a document, press Back. Verify the same type filter is still active.

5. **Scroll position preserved:**
   Scroll halfway down the list, open a document, press Back. Verify the scroll position is approximately restored.

6. **Sort state preserved:**
   Change sort to "Title A–Z", open a document, press Back. Verify the sort is still "Title A–Z".

---

## T10: Markdown CSS Theme

**Estimated effort:** 2 points

### What to do

Create `src/styles/markdown.css` with the GitHub-style Markdown theme, including highlight.js style import, heading borders, code blocks, inline code, blockquotes, tables, links, horizontal rules, images, and task list checkbox styling. Import this stylesheet globally.

### Implementation

**`src/styles/markdown.css`:**

```css
/* Import highlight.js GitHub theme for syntax highlighting */
@import "highlight.js/styles/github.css";

/*
 * GitHub-style Markdown theme overrides.
 * Applied inside the `.markdown-content` wrapper.
 * Tailwind `prose` handles most defaults; these are surgical refinements.
 */

/* Base typography */
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

/* Fenced code blocks */
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

/* GFM task list checkboxes */
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

**Import in `src/styles/globals.css` (or `main.tsx`):**

Add to the existing globals file:

```css
@import "./markdown.css";
```

### Files touched

| File | Action |
|------|--------|
| `src/styles/markdown.css` | **New** |
| `src/styles/globals.css` | **Modified** — add `@import "./markdown.css"` |

### Dependencies

- T1 (highlight.js must be installed for the `@import` to resolve)
- F1 (globals.css, Tailwind CSS variables like `--muted`, `--border`, `--foreground`)

### Verification

1. **Visual check — headings:**
   Render a document with `h1` and `h2`. Verify they have bottom borders.

2. **Visual check — code blocks:**
   Render a fenced code block. Verify it has a muted background, border, rounded corners, and syntax highlighting colours.

3. **Visual check — inline code:**
   Render `` `inline code` ``. Verify it has a subtle background and monospace font.

4. **Visual check — tables:**
   Render a GFM table. Verify bordered cells, bold header row, and alternating row backgrounds.

5. **Visual check — blockquotes:**
   Render `> quoted text`. Verify the left border accent and muted text colour.

6. **Visual check — task lists:**
   Render `- [x] Done` and `- [ ] Todo`. Verify checkbox alignment and no bullet markers.

7. **Theme variable integration:**
   Verify the CSS uses `var(--border)`, `var(--muted)`, `var(--foreground)` so it adapts to the Mist/Sky theme.

---

## Summary Table

| Task | Title | Points | Dependencies | Files Created | Files Modified |
|------|-------|--------|--------------|---------------|----------------|
| T1 | npm dependencies | 0.5 | F1 | — | `package.json`, `pnpm-lock.yaml` |
| T2 | Document content reader + type colours + references | 3 | T1, F2 | `document.ts`, `type-colours.ts` | `references.ts` |
| T3 | MarkdownViewer component | 5 | T1, T10 | `MarkdownViewer.tsx` | — |
| T4 | DriftBadge component | 2 | F1 | `DriftBadge.tsx` | — |
| T5 | DocumentList component | 5 | T2, T6, F1, F2 | `DocumentList.tsx` | — |
| T6 | Document filter bar | 3 | F1 | `DocumentFilterBar.tsx` | — |
| T7 | MetadataPanel component | 5 | T2, T4, F1, F2 | `MetadataPanel.tsx` | — |
| T8 | DocumentViewer component | 3 | T2, T3, T7 | `DocumentViewer.tsx` | — |
| T9 | DocumentsView container | 2 | T5, T8, F1 | `DocumentsView.tsx` | `ui-store.ts` |
| T10 | Markdown CSS theme | 2 | T1, F1 | `markdown.css` | `globals.css` |
| **Total** | | **30.5** | | **9 new** | **4 modified** |

---

## Complete File Manifest

| # | Path | Purpose | New / Modified |
|---|------|---------|----------------|
| 1 | `src/components/document/DocumentsView.tsx` | Container: list ↔ viewer navigation, scroll preservation | New |
| 2 | `src/components/document/DocumentList.tsx` | Filterable, sortable document list | New |
| 3 | `src/components/document/DocumentFilterBar.tsx` | Type toggles, status toggles, sort dropdown | New |
| 4 | `src/components/document/DocumentViewer.tsx` | Viewer layout: content area + metadata sidebar | New |
| 5 | `src/components/document/MarkdownViewer.tsx` | `react-markdown` wrapper with GFM, highlighting, sanitization | New |
| 6 | `src/components/document/MetadataPanel.tsx` | Right sidebar metadata fields | New |
| 7 | `src/components/document/DriftBadge.tsx` | Status + drift-detection badge | New |
| 8 | `src/lib/reader/document.ts` | Read Markdown file from disk, compute SHA-256, return drift result | New |
| 9 | `src/lib/constants/type-colours.ts` | Document-type → colour mapping | New |
| 10 | `src/lib/query/references.ts` | `getRelatedEntities()` reverse lookup | Modified |
| 11 | `src/styles/markdown.css` | GitHub-style Markdown prose theme | New |
| 12 | `src/styles/globals.css` | Import `markdown.css` | Modified |
| 13 | `src/lib/store/ui-store.ts` | `documentListFilters` state slice | Modified |
| 14 | `package.json` | New npm dependencies | Modified |

---

## Testing Strategy

### Unit Tests

| Scope | Test File | What to Test |
|-------|-----------|-------------|
| SHA-256 computation | `document.test.ts` | `computeSHA256` produces correct hashes; empty string, ASCII, Unicode inputs |
| Hash matching | `document.test.ts` | `readDocument` returns correct `hashMatches` for matching hash, mismatching hash, absent hash, missing file |
| Drift state resolution | `DriftBadge.test.ts` | `resolveDriftState` for all combinations in the truth table (§T4) |
| Type colours | `type-colours.test.ts` | `getTypeColour` returns correct colours for known types and unknown types |
| Related entity lookup | `references.test.ts` | `getRelatedEntities` finds plans/features referencing a document; returns empty for no references |
| Filter logic | `DocumentList.test.ts` | `filterDocuments` with various type/status combinations, including empty sets |
| Sort logic | `DocumentList.test.ts` | `sortDocuments` for all 6 sort options; verify stable sort for equal keys |
| Slugify | `MarkdownViewer.test.ts` | `slugify("2.1 Data Model")` → `"21-data-model"` and other spec examples |

### Component Tests

| Component | What to Verify |
|-----------|----------------|
| `DriftBadge` | Correct badge colour/icon/label for each drift state; unknown status shows raw string |
| `MarkdownViewer` | GFM table, task list, strikethrough, code highlighting render correctly; headings have `id` attributes; `<script>` tags are sanitized |
| `MetadataPanel` | All 7 fields render in order; absent fields show "(none)"; content hash status shows correct variant |
| `DocumentFilterBar` | Toggle activation/deactivation; sort dropdown changes; layout is correct |
| `DocumentList` | Rows render with correct data; badge clicks toggle filters; empty states display; sort changes order |
| `DocumentViewer` | Loading → content transition; file-not-found state; back button calls `onBack` |
| `DocumentsView` | List ↔ viewer navigation; filter state preserved across round-trip |

### Integration Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Full round-trip | Open project → Documents tab → click row → view content → Back | List state preserved |
| Drift detection | Approve doc with kbz → open in KBZV → modify file → reopen | Badge changes from green to orange |
| Filter + sort | Apply type filter → change sort → open doc → Back | Both filter and sort preserved |

### Manual Smoke Tests

| # | Test | Steps |
|---|------|-------|
| 1 | Open a real kanbanzai project with registered documents | Documents appear with titles, dates, types, statuses |
| 2 | Read a specification document | Full Markdown renders with tables, code blocks, headings |
| 3 | Verify drift on a modified document | Edit a file on disk → reopen → orange badge appears |
| 4 | Verify scroll preservation | Scroll halfway → open doc → Back → same position |
| 5 | All filters work | Toggle types and statuses, verify AND/OR logic |

---

## Risk Areas

### High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| `rehype-highlight` + `rehype-sanitize` plugin ordering | If reversed, syntax highlighting classes are stripped and code blocks render unstyled | Spec mandates `rehypeHighlight` before `rehypeSanitize` in the array; unit test confirms `hljs-*` classes survive |
| SHA-256 mismatch between KBZV and kanbanzai | Approved documents would always show as "modified" (false positive drift) | Both use UTF-8 byte encoding; verify with integration test comparing hex digests |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| `@tailwindcss/typography` (`prose`) not installed | MarkdownViewer wrapper class `prose prose-slate` has no effect; headings, spacing, lists look wrong | Verify `@tailwindcss/typography` is in F1's dependencies; add install step to T1 if missing |
| Scroll position restoration race condition | `useLayoutEffect` fires before content has rendered, `scrollTop` set on empty container | Verify in component test; may need `requestAnimationFrame` wrapper if timing is off |
| Large Markdown files cause UI jank | `react-markdown` re-parses on every render; files >500KB may cause noticeable lag | Acceptable for F4 (typical docs are <100KB); virtualised rendering deferred to future |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Unknown doc types not shown when filters are active | Users might wonder where their `rca` doc went | Documented behaviour; no filter bar toggle for rare types; visible when no type filter is active |
| Duplicate heading IDs | Two identical headings in one document share the same `id`; anchor links jump to the first | Rare in practice; F4 does not handle deduplication per spec |
| `EntityLink` inert click confusing to users | Users may try to click Owner or Related Entity links and nothing happens | Acceptable for F4; F5 will wire navigation; no `cursor-pointer` on inert links |

---

## References

- Spec: `work/spec/f4-documents-view-spec.md` (requirements, exact code, acceptance criteria)
- Design: `work/design/f4-documents-view.md` (layout, data model, architecture decisions)
- Architecture: `work/design/kbzv-architecture.md` §6.4–6.5, §7, §8
- react-markdown: https://github.com/remarkjs/react-markdown
- remark-gfm: https://github.com/remarkjs/remark-gfm
- rehype-highlight: https://github.com/rehypejs/rehype-highlight
- rehype-sanitize: https://github.com/rehypejs/rehype-sanitize