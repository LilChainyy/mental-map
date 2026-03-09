import { useCallback, useEffect } from 'react';
import { useGraphStore } from '../store';
import { mergeGeneratedGraph } from '../utils/merge';
import { getCachedGraph, setCachedGraph } from '../db';
import type { GeneratedGraph } from '../types';

export function useGenerateGraph() {
  const bulkAddNodes = useGraphStore((s) => s.bulkAddNodes);
  const updateNode = useGraphStore((s) => s.updateNode);
  const bulkAddEdges = useGraphStore((s) => s.bulkAddEdges);
  const recalcConnectionCounts = useGraphStore((s) => s.recalcConnectionCounts);
  const setCenteredNode = useGraphStore((s) => s.setCenteredNode);
  const setIsGenerating = useGraphStore((s) => s.setIsGenerating);
  const setFocusNode = useGraphStore((s) => s.setFocusNode);

  const generate = useCallback(
    async (concept: string) => {
      setIsGenerating(true);
      try {
        // Check cache first
        let generated: GeneratedGraph | null = await getCachedGraph(concept);

        if (!generated) {
          // Cache miss: call the API
          const response = await fetch('/api/generate-graph', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ concept }),
          });

          if (!response.ok) {
            let errorMsg = `Server error (${response.status})`;
            try {
              const err = await response.json();
              errorMsg = err.error || errorMsg;
            } catch {
              // Response wasn't JSON
            }
            throw new Error(errorMsg);
          }

          generated = await response.json() as GeneratedGraph;

          // Store in cache (fire and forget)
          setCachedGraph(concept, generated);
        }

        const { nodes: currentNodes, edges: currentEdges, currentMapId } = useGraphStore.getState();
        const result = mergeGeneratedGraph(generated, currentNodes, currentEdges, currentMapId!) as ReturnType<typeof mergeGeneratedGraph> & { centeredNodeId?: string };

        // Apply merge
        if (result.nodesToAdd.length > 0) {
          await bulkAddNodes(result.nodesToAdd);
        }
        for (const { id, updates } of result.nodesToUpdate) {
          await updateNode(id, updates);
        }
        if (result.edgesToAdd.length > 0) {
          await bulkAddEdges(result.edgesToAdd);
        }

        await recalcConnectionCounts();

        if (result.centeredNodeId) {
          setCenteredNode(result.centeredNodeId);
          setTimeout(() => {
            setFocusNode(result.centeredNodeId!);
          }, 500);
        }

      } catch (error) {
        console.error('Graph generation failed:', error);
        alert(error instanceof Error ? error.message : 'Failed to generate graph');
      } finally {
        setIsGenerating(false);
      }
    },
    [bulkAddNodes, updateNode, bulkAddEdges, recalcConnectionCounts, setCenteredNode, setIsGenerating, setFocusNode]
  );

  // Listen for drill-down events from Graph3D
  useEffect(() => {
    const handler = (e: Event) => {
      const label = (e as CustomEvent).detail?.label;
      if (!label) return;
      generate(label);
    };
    window.addEventListener('graph-drilldown', handler);
    return () => window.removeEventListener('graph-drilldown', handler);
  }, [generate]);

  return { generate };
}
