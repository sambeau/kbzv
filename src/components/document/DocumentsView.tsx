// src/components/document/DocumentsView.tsx

import { DocumentList } from "./DocumentList";
import { DocumentViewer } from "./DocumentViewer";
import { useUIStore } from "@/lib/store/ui-store";

function DocumentsView() {
  const documentViewMode = useUIStore((s) => s.documentViewMode);

  if (documentViewMode === "viewer") {
    return <DocumentViewer />;
  }

  return <DocumentList />;
}

export { DocumentsView };
