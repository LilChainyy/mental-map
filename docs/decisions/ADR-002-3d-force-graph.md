# ADR-002: 3D Force-Directed Graph Visualization

**Date:** 2026-03-08
**Status:** Accepted

---

## Context

Knowledge graphs need to be rendered as interactive node-link diagrams. The main dimensions of the decision were:

- **2D vs 3D**
- **Force-directed layout vs manual/hierarchical layout**
- **Library vs custom Three.js implementation**

Options considered:
1. **2D force graph** (D3.js, react-force-graph-2d, Cytoscape.js)
2. **3D force graph** (react-force-graph-3d)
3. **Hierarchical/tree layout** (D3 hierarchy, ELK)
4. **Custom Three.js** (full manual implementation)

---

## Decision

Use **react-force-graph-3d** for rendering, backed by **Three.js** directly for custom node objects and camera manipulation.

---

## Rationale

**3D over 2D:** The primary argument for 3D is spatial memory and navigability. In a 2D graph with 30+ nodes, the layout becomes cluttered and hard to navigate — users spend cognitive effort on the layout rather than the concepts. In 3D, the graph has depth to expand into; nodes that would overlap in 2D separate in z-space. The camera orbit interaction also gives users a sense of "touring" the knowledge space, which matches the product's exploration metaphor. 3D also creates a visual distinctiveness that 2D graphs (familiar from every graph tool on the market) cannot.

**Force-directed over hierarchical:** Concept graphs are not trees. The relationships between ideas are lateral, circular, and multi-parent. Force-directed layouts emerge naturally from the edge structure — highly connected nodes become central, peripherally related nodes cluster at the edges. This reflects the actual semantic structure better than any imposed hierarchy.

**react-force-graph-3d over custom:** The library handles the full Three.js scene, OrbitControls, force simulation (via d3-force-3d), and the React integration. Writing this from scratch would be weeks of work for equivalent functionality. The library exposes `fgRef` (imperative handle) and callback props (`nodeThreeObject`, `linkColor`, `onNodeClick`) that give sufficient customization for Mental Map's needs — custom node objects, edge colors, click/double-click handling, camera control.

**Custom Three.js for node objects:** `nodeThreeObject` allows replacing the default sphere with a custom `THREE.Group`. Mental Map uses this to render a color-coded sphere + billboard sprite label per node, with visual weight (sphere radius, label font size, opacity) proportional to connection count. This required direct Three.js work but is well-contained in `src/utils/visuals.ts`.

---

## Consequences

**Positive:**
- Spatially distinctive product — feels different from flat graph tools
- Force-directed layout is self-organizing; no layout tuning needed
- Direct Three.js access enables custom node rendering, depth fading, hand tracking camera control
- `d3ReheatSimulation()` allows programmatic "nudging" of the physics sim (used when stitched edges are added)

**Negative:**
- 3D graph navigation has a steeper learning curve than a 2D pan/zoom
- Three.js bundle is large (~580kb minified). This is accepted given the product's desktop-first nature
- The library's TypeScript definitions use `any` in several places (noted with `// eslint-disable-next-line` comments throughout `Graph3D.tsx`)
- Performance degrades at very large graphs (500+ nodes). A clustering or LOD strategy will be needed if maps grow that large

**Deferred:** A 2D fallback or "overview" mode might be worth adding for users who find 3D disorienting, but it is not in scope for Phase 1.
