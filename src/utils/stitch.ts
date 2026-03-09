import type { GraphEdge, StitchResult, StitchEdge } from '../types';
import { db } from '../db';

/**
 * Determine whether stitching should run after a merge.
 * Conditions: graph has 15+ nodes AND the merge added new nodes (implying multiple clusters).
 */
export function shouldStitch(
  totalNodes: number,
  nodesAddedInMerge: number,
  isFirstSearch: boolean
): boolean {
  if (isFirstSearch) return false;
  if (totalNodes < 15) return false;
  if (nodesAddedInMerge < 5) return false;
  return true;
}

/**
 * Validate stitch results: only accept edges where both source and target
 * exist in the current graph, and the edge doesn't duplicate an existing one.
 */
export function validateStitchResult(
  result: StitchResult,
  nodeIds: Set<string>,
  existingEdges: GraphEdge[]
): StitchEdge[] {
  return result.edges.filter((e) => {
    // Both nodes must exist
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) return false;
    // No self-loops
    if (e.source === e.target) return false;
    // No duplicates with existing edges (bidirectional check)
    const isDup = existingEdges.some(
      (ex) =>
        (ex.source === e.source && ex.target === e.target) ||
        (ex.source === e.target && ex.target === e.source)
    );
    return !isDup;
  });
}

/**
 * Filter out edges that the user previously deleted (from deletedStitchedEdges table).
 */
export async function filterDeletedStitchedEdges(
  edges: StitchEdge[],
  mapId: string
): Promise<StitchEdge[]> {
  const deletedKeys = new Set(
    (await db.deletedStitchedEdges.where('mapId').equals(mapId).toArray()).map((d) => d.key)
  );
  return edges.filter((e) => {
    const key = [e.source, e.target].sort().join('|');
    return !deletedKeys.has(key);
  });
}
