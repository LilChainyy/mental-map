import type { GraphNode, GraphEdge } from '../types';

export interface ClusterData {
  clusters: { nodeIds: string[]; labels: string[] }[];
  isDisconnected: boolean;
}

export function detectClusters(nodes: GraphNode[], edges: GraphEdge[]): ClusterData {
  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) {
    adjacency.set(node.id, new Set());
  }
  for (const edge of edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const visited = new Set<string>();
  const clusters: { nodeIds: string[]; labels: string[] }[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const component: string[] = [];
    const queue = [node.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      component.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
    clusters.push({
      nodeIds: component,
      labels: component.map((id) => nodeMap.get(id)!.label),
    });
  }

  return { clusters, isDisconnected: clusters.length > 1 };
}
