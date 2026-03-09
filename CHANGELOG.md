# Changelog

All notable changes to Mental Map will be documented here. This project follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### In Progress
- Domain-agnostic AI prompts (remove CS/software engineering restriction from `generate-graph` and `stitch-edges` system prompts)
- Graph export (PNG canvas screenshot, JSON map export)
- Empty-state onboarding (explain drill-down, stitching, and edge colors on first visit)

---

## [0.1.0] — 2026-03-08

Initial release.

### Added
- AI-generated concept graphs via Claude (`claude-sonnet-4-20250514`) — search any concept to generate 8–15 related nodes with typed edges
- Drill-down exploration — double-click any node to expand it as a new concept subgraph, merged into the current map
- Cross-cluster stitching — AI analyzes disconnected clusters and suggests cross-cluster edges and bridge nodes
- Multi-map workspace — create, rename, delete, and switch between named maps
- Node management — add, edit (label, description, notes, color, links), and delete nodes
- Manual edge creation and deletion
- Node color-coding with 6 preset colors
- Visual weight system — node sphere size and label scale with connection count
- Depth-based label fading — far nodes dim, near nodes stay sharp
- Detail panel — selected node metadata with inline editing
- Local-first persistence via Dexie/IndexedDB (DB schema v1–v5 with migrations)
- API response caching — concept graphs cached in IndexedDB, repeat searches are instant and free
- Hand gesture navigation via MediaPipe HandLandmarker
  - Pointing (index extended): orbit camera
  - Spread (thumb + index): zoom
  - Pinch (thumb + index close): pan; hold still 500ms to select highlighted node
  - Picture-in-picture webcam overlay with finger visualization
- Keyboard shortcuts: `/` (search), `Backspace` (delete selected node), `Escape` (dismiss)
- Zustand global state store with full map/node/edge CRUD
- Vite 7 API routes for `generate-graph` and `stitch-edges` (server-side Anthropic API calls, key never exposed to browser)
- React 19, TypeScript 5.9, Tailwind CSS v4
- Vitest test suite with fake-indexeddb for DB layer tests
