// src/lib/reader/document.ts

/**
 * Reads the content of a document file referenced by a DocumentRecord.
 *
 * STUB: This function is a placeholder for F4 (Documents View).
 * In F2, it returns null for all calls. F4 will implement the full
 * logic including Markdown reading and content hash verification.
 *
 * @param _projectPath - Absolute path to the project root
 * @param _documentPath - Relative path from DocumentRecord.path
 * @returns null (stub). F4 will return the file content as a string, or null on error.
 */
export async function readDocumentContent(
  _projectPath: string,
  _documentPath: string,
): Promise<string | null> {
  // F4 will implement: read file at `${_projectPath}/${_documentPath}`, return content string
  return null;
}
