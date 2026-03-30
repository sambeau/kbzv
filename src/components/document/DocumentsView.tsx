// src/components/document/DocumentsView.tsx

import { useState } from "react";
import { DocumentList } from "./DocumentList";
import { DocumentViewer } from "./DocumentViewer";
import { useUIStore } from "@/lib/store/ui-store";
import type { DocumentListFilters } from "@/lib/store/ui-store";

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
      onFiltersChange={(f: DocumentListFilters) => setFilters(f)}
    />
  );
}

export { DocumentsView };
