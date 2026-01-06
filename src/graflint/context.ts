import type {
  OCIFDocument,
  OCIFNode,
  OCIFRelation,
  OCIFResource,
} from "./types/ocif";
import type { RuleContext } from "./types/diagnostic";

/**
 * Creates a RuleContext for a document with the given options.
 * Simple implementation - no acceleration structures, just direct lookups.
 */
export function createContext(
  document: OCIFDocument,
  options: Record<string, unknown> = {}
): RuleContext {
  return {
    document,
    options,

    getNode(id: string): OCIFNode | undefined {
      return document.nodes?.find((n) => n.id === id);
    },

    getRelation(id: string): OCIFRelation | undefined {
      return document.relations?.find((r) => r.id === id);
    },

    getResource(id: string): OCIFResource | undefined {
      return document.resources?.find((r) => r.id === id);
    },

    hasExtension(element: OCIFNode | OCIFRelation, type: string): boolean {
      return element.data?.some((ext) => ext.type === type) ?? false;
    },

    getExtension<T>(element: OCIFNode | OCIFRelation, type: string): T | undefined {
      const ext = element.data?.find((e) => e.type === type);
      return ext as T | undefined;
    },
  };
}

/**
 * Get all IDs that exist in the document (nodes, relations, resources)
 */
export function getAllIds(document: OCIFDocument): Set<string> {
  const ids = new Set<string>();

  document.nodes?.forEach((n) => ids.add(n.id));
  document.relations?.forEach((r) => ids.add(r.id));
  document.resources?.forEach((r) => ids.add(r.id));

  return ids;
}

/**
 * Check if an ID exists in the document
 */
export function idExists(document: OCIFDocument, id: string): boolean {
  return (
    document.nodes?.some((n) => n.id === id) ||
    document.relations?.some((r) => r.id === id) ||
    document.resources?.some((r) => r.id === id) ||
    false
  );
}
