// src/components/document/MarkdownViewer.tsx

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Components } from "react-markdown";
import type React from "react";

// ── Props ───────────────────────────────────────────────────────────

interface MarkdownViewerProps {
  content: string;
}

// ── Sanitize Schema ─────────────────────────────────────────────────

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

// ── Heading Utilities ───────────────────────────────────────────────

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

// ── Custom Components ───────────────────────────────────────────────

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

// ── Component ───────────────────────────────────────────────────────

function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="markdown-content prose prose-slate max-w-[700px] w-full">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, [rehypeSanitize, sanitizeSchema]]}
        components={customComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export { MarkdownViewer };
export type { MarkdownViewerProps };
