import type { GraphNode, GraphEdge, GeneratedGraph } from '../types';
import { DEFAULT_NODE_COLOR } from '../types';
import { generateId } from './id';

export interface MergeResult {
  nodesToAdd: GraphNode[];
  nodesToUpdate: { id: string; updates: Partial<GraphNode> }[];
  edgesToAdd: GraphEdge[];
}

export function mergeGeneratedGraph(
  generated: GeneratedGraph,
  existingNodes: GraphNode[],
  existingEdges: GraphEdge[],
  mapId: string
): MergeResult {
  const nodesToAdd: GraphNode[] = [];
  const nodesToUpdate: { id: string; updates: Partial<GraphNode> }[] = [];
  const edgesToAdd: GraphEdge[] = [];

  // Map generated IDs to real IDs (existing or new)
  const idMap = new Map<string, string>();

  const now = Date.now();

  for (const genNode of generated.nodes) {
    // Try to find existing node by label (case-insensitive)
    const existing = existingNodes.find(
      (n) => n.label.toLowerCase() === genNode.label.toLowerCase()
    );

    if (existing) {
      idMap.set(genNode.id, existing.id);
      // Only update if user hasn't edited it
      if (!existing.isUserEdited) {
        nodesToUpdate.push({
          id: existing.id,
          updates: { description: genNode.description },
        });
      }
    } else {
      const newId = generateId();
      idMap.set(genNode.id, newId);
      nodesToAdd.push({
        id: newId,
        mapId,
        label: genNode.label,
        description: genNode.description,
        color: DEFAULT_NODE_COLOR,
        connectionCount: 0,
        isUserEdited: false,
        isUserAdded: false,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  for (const genEdge of generated.edges) {
    const sourceId = idMap.get(genEdge.source);
    const targetId = idMap.get(genEdge.target);
    if (!sourceId || !targetId || sourceId === targetId) continue;

    // Check for duplicate edges (in existing + already queued)
    const isDup =
      existingEdges.some(
        (e) =>
          (e.source === sourceId && e.target === targetId) ||
          (e.source === targetId && e.target === sourceId)
      ) ||
      edgesToAdd.some(
        (e) =>
          (e.source === sourceId && e.target === targetId) ||
          (e.source === targetId && e.target === sourceId)
      );
    if (isDup) continue;

    edgesToAdd.push({
      id: generateId(),
      mapId,
      source: sourceId,
      target: targetId,
      color: genEdge.color ?? 'blue',
      isUserAdded: false,
      isStitched: false,
      createdAt: now,
    });
  }

  // Resolve centeredNodeId
  const centeredRealId = idMap.get(generated.centerNodeId);

  return {
    nodesToAdd,
    nodesToUpdate,
    edgesToAdd,
    centeredNodeId: centeredRealId,
  } as MergeResult & { centeredNodeId?: string };
}
