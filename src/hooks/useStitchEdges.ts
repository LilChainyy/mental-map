import { useCallback, useRef } from 'react';
import { useGraphStore } from '../store';
import { shouldStitch, validateStitchResult, filterDeletedStitchedEdges } from '../utils/stitch';
import { detectClusters } from '../utils/clusters';
import { generateId } from '../utils/id';
import { DEFAULT_NODE_COLOR } from '../types';
import type { GraphNode, GraphEdge, StitchResult } from '../types';

const MAX_STITCH_ROUNDS = 2;

/**
 * Shared logic for calling the stitch API and processing the result.
 * Returns true if any new nodes/edges were added.
 */
async function processStitchRound(
  bulkAddNodes: (nodes: GraphNode[]) => Promise<void>,
  bulkAddEdges: (edges: GraphEdge[]) => Promise<void>,
): Promise<boolean> {
  const { nodes: currentNodes, edges: currentEdges, currentMapId } = useGraphStore.getState();

  const clusterData = detectClusters(currentNodes, currentEdges);
  if (!clusterData.isDisconnected) return false;

  const nodeLabels = currentNodes.map((n) => n.label);
  const existingEdgePairs = currentEdges.map((e) => {
    const sourceNode = currentNodes.find((n) => n.id === e.source);
    const targetNode = currentNodes.find((n) => n.id === e.target);
    return {
      source: sourceNode?.label ?? e.source,
      target: targetNode?.label ?? e.target,
    };
  });
  const clusters = clusterData.clusters.map((c) => c.labels);

  const response = await fetch('/api/stitch-edges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodes: nodeLabels, existingEdges: existingEdgePairs, clusters }),
  });

  if (!response.ok) {
    console.warn('Stitch API returned error:', response.status);
    return false;
  }

  const result: StitchResult = await response.json();

  // Build label→ID map from current nodes
  const labelToId = new Map(currentNodes.map((n) => [n.label.toLowerCase(), n.id]));

  // Process bridge nodes first (so their labels are in the map for edge resolution)
  const bridgeNodes: GraphNode[] = [];
  if (result.bridgeNodes?.length) {
    const now = Date.now();
    for (const bn of result.bridgeNodes) {
      // Skip if a node with this label already exists
      if (labelToId.has(bn.label.toLowerCase())) continue;

      const nodeId = generateId();
      labelToId.set(bn.label.toLowerCase(), nodeId);
      bridgeNodes.push({
        id: nodeId,
        mapId: currentMapId!,
        label: bn.label,
        description: bn.description,
        color: DEFAULT_NODE_COLOR,
        connectionCount: 0,
        isUserEdited: false,
        isUserAdded: false,
        isBridgeNode: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (bridgeNodes.length > 0) {
      await bulkAddNodes(bridgeNodes);
    }
  }

  // Map labels back to node IDs
  const mappedEdges = result.edges.map((e) => ({
    ...e,
    source: labelToId.get(e.source.toLowerCase()) ?? e.source,
    target: labelToId.get(e.target.toLowerCase()) ?? e.target,
  }));
  const mappedResult: StitchResult = { edges: mappedEdges };

  // Re-read edges after bridge node addition
  const latestEdges = useGraphStore.getState().edges;
  const latestNodes = useGraphStore.getState().nodes;
  const nodeIdSet = new Set(latestNodes.map((n) => n.id));
  const validated = validateStitchResult(mappedResult, nodeIdSet, latestEdges);
  const filtered = await filterDeletedStitchedEdges(validated, currentMapId!);

  if (filtered.length > 0) {
    const now = Date.now();
    const newEdges: GraphEdge[] = filtered.map((e) => ({
      id: generateId(),
      mapId: currentMapId!,
      source: e.source,
      target: e.target,
      color: e.color,
      isUserAdded: false,
      isStitched: true,
      createdAt: now,
    }));
    await bulkAddEdges(newEdges);
  }

  return bridgeNodes.length > 0 || filtered.length > 0;
}

export function useStitchEdges() {
  const bulkAddNodes = useGraphStore((s) => s.bulkAddNodes);
  const bulkAddEdges = useGraphStore((s) => s.bulkAddEdges);
  const recalcConnectionCounts = useGraphStore((s) => s.recalcConnectionCounts);
  const setIsStitching = useGraphStore((s) => s.setIsStitching);

  // Track last stitch node-set to avoid redundant calls
  const lastStitchKey = useRef<string>('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const stitch = useCallback(
    async (nodesAddedInMerge: number) => {
      const { nodes, edges } = useGraphStore.getState();
      const isFirstSearch = edges.length === 0 && nodesAddedInMerge === nodes.length;

      if (!shouldStitch(nodes.length, nodesAddedInMerge, isFirstSearch)) return;

      // Cache key: sorted node IDs joined
      const cacheKey = nodes.map((n) => n.id).sort().join(',');
      if (cacheKey === lastStitchKey.current) return;

      // Debounce: wait 500ms before firing
      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      return new Promise<void>((resolve) => {
        debounceTimer.current = setTimeout(async () => {
          setIsStitching(true);
          try {
            let anyChanges = false;

            for (let round = 0; round < MAX_STITCH_ROUNDS; round++) {
              const changed = await processStitchRound(bulkAddNodes, bulkAddEdges);
              if (changed) anyChanges = true;
              if (!changed) break; // No changes or already connected
            }

            if (anyChanges) {
              await recalcConnectionCounts();
              const edgeIds = useGraphStore.getState().edges
                .filter((e) => e.isStitched)
                .map((e) => e.id);
              window.dispatchEvent(
                new CustomEvent('stitch-complete', { detail: { edgeIds } })
              );
            }

            lastStitchKey.current = cacheKey;
          } catch (error) {
            console.warn('Stitching failed:', error);
          } finally {
            setIsStitching(false);
            resolve();
          }
        }, 500);
      });
    },
    [bulkAddNodes, bulkAddEdges, recalcConnectionCounts, setIsStitching]
  );

  // Manual trigger — always runs regardless of shouldStitch conditions
  const manualStitch = useCallback(async () => {
    const { nodes } = useGraphStore.getState();
    if (nodes.length < 2) return;

    setIsStitching(true);
    try {
      let anyChanges = false;

      for (let round = 0; round < MAX_STITCH_ROUNDS; round++) {
        const changed = await processStitchRound(bulkAddNodes, bulkAddEdges);
        if (changed) anyChanges = true;
        if (!changed) break;
      }

      if (anyChanges) {
        await recalcConnectionCounts();
        const edgeIds = useGraphStore.getState().edges
          .filter((e) => e.isStitched)
          .map((e) => e.id);
        window.dispatchEvent(
          new CustomEvent('stitch-complete', { detail: { edgeIds } })
        );
      }
    } catch (error) {
      console.warn('Manual stitching failed:', error);
      alert(error instanceof Error ? error.message : 'Stitching failed');
    } finally {
      setIsStitching(false);
    }
  }, [bulkAddNodes, bulkAddEdges, recalcConnectionCounts, setIsStitching]);

  return { stitch, manualStitch };
}
