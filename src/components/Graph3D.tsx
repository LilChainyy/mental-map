import { useRef, useCallback, useMemo, useEffect } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import type { ForceGraphMethods } from 'react-force-graph-3d';
import * as THREE from 'three';
import { useGraphStore } from '../store';
import { EDGE_COLORS } from '../types';
import type { GraphNode } from '../types';
import { createNodeObject, createHighlightRing } from '../utils/visuals';
import { useHandTracking } from '../hooks/useHandTracking';
import { HandTrackingPIP } from './HandTrackingPIP';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FgRef = ForceGraphMethods<any, any>;

const DEPTH_FADE_THROTTLE_MS = 100;

export function Graph3D() {
  const fgRef = useRef<FgRef>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const selectNode = useGraphStore((s) => s.selectNode);
  const deleteNode = useGraphStore((s) => s.deleteNode);
  const focusNodeId = useGraphStore((s) => s.focusNodeId);
  const setFocusNode = useGraphStore((s) => s.setFocusNode);
  const highlightedNodeId = useGraphStore((s) => s.highlightedNodeId);

  useHandTracking({ fgRef, videoRef, canvasRef, containerRef });

  // Track label sprites for depth-based opacity fading
  const labelMapRef = useRef<Map<string, THREE.Sprite>>(new Map());
  // Track node groups for highlight ring
  const nodeGroupMapRef = useRef<Map<string, THREE.Group>>(new Map());
  const highlightRingRef = useRef<THREE.Mesh | null>(null);
  const lastFadeTime = useRef<number>(0);

  const graphData = useMemo(() => ({
    nodes: nodes.map((n) => ({ ...n })),
    links: edges.map((e) => ({ ...e })),
  }), [nodes, edges]);

  const lastClickTime = useRef<number>(0);
  const lastClickNode = useRef<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeClick = useCallback((node: any, event: MouseEvent) => {
    const now = Date.now();
    const isDoubleClick =
      now - lastClickTime.current < 400 &&
      lastClickNode.current === node.id;

    lastClickTime.current = now;
    lastClickNode.current = node.id;

    if (isDoubleClick) {
      // Double click: fly to node and trigger drill-down
      if (fgRef.current && node.x !== undefined && node.y !== undefined && node.z !== undefined) {
        const distance = 80;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        fgRef.current.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
          { x: node.x, y: node.y, z: node.z },
          1000
        );
      }
      // Dispatch custom event for drill-down (useGenerateGraph listens)
      window.dispatchEvent(
        new CustomEvent('graph-drilldown', { detail: { label: node.label } })
      );
    } else {
      selectNode(node.id);
    }
    void event;
  }, [selectNode]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeRightClick = useCallback((node: any) => {
    if (confirm(`Delete "${node.label}"?`)) {
      deleteNode(node.id);
    }
  }, [deleteNode]);

  const handleBackgroundClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  // Camera fly-to when focusNodeId changes
  useEffect(() => {
    if (!focusNodeId || !fgRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = graphData.nodes.find((n: any) => n.id === focusNodeId) as any;
    if (node && node.x !== undefined && node.y !== undefined && node.z !== undefined) {
      const distance = 80;
      const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z || 1);
      fgRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
        { x: node.x, y: node.y, z: node.z },
        1000
      );
    }
    setFocusNode(null);
  }, [focusNodeId, graphData.nodes, setFocusNode]);

  // Reheat force simulation when stitched edges arrive so clusters drift together
  useEffect(() => {
    const handler = () => {
      if (fgRef.current) {
        fgRef.current.d3ReheatSimulation();
      }
    };
    window.addEventListener('stitch-complete', handler);
    return () => window.removeEventListener('stitch-complete', handler);
  }, []);

  // Depth-based label fading — throttled to 100ms
  useEffect(() => {
    let animId: number;

    function updateDepthFade() {
      animId = requestAnimationFrame(updateDepthFade);

      const now = performance.now();
      if (now - lastFadeTime.current < DEPTH_FADE_THROTTLE_MS) return;
      lastFadeTime.current = now;

      const fg = fgRef.current;
      if (!fg || labelMapRef.current.size === 0) return;

      const camera = fg.camera();
      if (!camera) return;

      const camPos = camera.position;

      // Compute squared distances from camera to each node
      const nodeDistances: { id: string; distSq: number }[] = [];
      for (const node of graphData.nodes) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const n = node as any;
        if (n.x === undefined) continue;
        const dx = n.x - camPos.x;
        const dy = n.y - camPos.y;
        const dz = (n.z ?? 0) - camPos.z;
        nodeDistances.push({ id: n.id, distSq: dx * dx + dy * dy + dz * dz });
      }

      if (nodeDistances.length === 0) return;

      // Sort by distance (ascending = closest first)
      nodeDistances.sort((a, b) => a.distSq - b.distSq);
      const midpoint = Math.ceil(nodeDistances.length / 2);

      for (let i = 0; i < nodeDistances.length; i++) {
        const label = labelMapRef.current.get(nodeDistances[i].id);
        if (!label?.material) continue;
        const mat = label.material as THREE.SpriteMaterial;
        const targetOpacity = i < midpoint ? 1.0 : 0.3;
        if (Math.abs(mat.opacity - targetOpacity) > 0.01) {
          mat.opacity = targetOpacity;
        }
      }

      // Clean stale entries periodically
      if (labelMapRef.current.size > graphData.nodes.length * 1.5) {
        const currentIds = new Set(graphData.nodes.map((n) => n.id));
        for (const id of labelMapRef.current.keys()) {
          if (!currentIds.has(id)) labelMapRef.current.delete(id);
        }
      }
    }

    animId = requestAnimationFrame(updateDepthFade);
    return () => cancelAnimationFrame(animId);
  }, [graphData.nodes]);

  const nodeThreeObject = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any) => {
      const group = createNodeObject(node as GraphNode);
      // Register the label sprite (2nd child) for depth-based fading
      const label = group.children[1] as THREE.Sprite | undefined;
      if (label) {
        labelMapRef.current.set(node.id, label);
      }
      nodeGroupMapRef.current.set(node.id, group);
      return group;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes]
  );

  // Highlight ring follows highlightedNodeId
  useEffect(() => {
    // Remove old ring
    if (highlightRingRef.current?.parent) {
      highlightRingRef.current.parent.remove(highlightRingRef.current);
    }
    highlightRingRef.current = null;

    if (!highlightedNodeId) return;

    const group = nodeGroupMapRef.current.get(highlightedNodeId);
    if (!group) return;

    const ring = createHighlightRing(8);
    group.add(ring);
    highlightRingRef.current = ring;

    return () => {
      if (ring.parent) ring.parent.remove(ring);
    };
  }, [highlightedNodeId]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkColor = useCallback((link: any) => EDGE_COLORS[link.color as keyof typeof EDGE_COLORS] ?? EDGE_COLORS.blue, []);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        nodeId="id"
        linkSource="source"
        linkTarget="target"
        backgroundColor="#ffffff"
        nodeThreeObject={nodeThreeObject}
        linkColor={linkColor}
        linkWidth={1.5}
        linkOpacity={0.6}
        onNodeClick={handleNodeClick}
        onNodeRightClick={handleNodeRightClick}
        onBackgroundClick={handleBackgroundClick}
        showNavInfo={false}
        cameraPosition={{ x: 0, y: 0, z: 150 }}
      />
      <HandTrackingPIP videoRef={videoRef} canvasRef={canvasRef} />
    </div>
  );
}
