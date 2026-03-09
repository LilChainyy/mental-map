# Roadmap

Mental Map is organized into phases. Each phase has a clear goal and defined scope before Phase 3 work begins. Items within a phase are not strictly ordered.

---

## Phase 1 — Foundation

**Goal:** A working, polished concept exploration tool that covers any knowledge domain and feels complete enough to share.

### Shipped
- AI-generated concept graphs (Claude generates 8–15 nodes + edges per concept)
- Drill-down exploration (double-click to expand any node)
- Cross-cluster stitching with bridge nodes
- Multi-map workspace (create, rename, delete, switch)
- Node CRUD (add, edit label/description/notes/color/links, delete)
- Manual edge creation and deletion
- Local-first persistence (IndexedDB via Dexie)
- API response caching (concept-level, no expiry)
- Hand gesture navigation via MediaPipe (orbit, zoom, pan, hold-to-select)
- Depth-based label fading in 3D scene
- Keyboard shortcuts (`/` for search, `Backspace` to delete, `Escape` to dismiss)

### In Progress / Remaining

**Domain-agnostic prompts** _(critical)_
The `generate-graph` and `stitch-edges` system prompts are hardcoded to CS/software engineering. The data model and UI are already domain-agnostic. The fix is updating both system prompts to accept any knowledge domain and removing the "Stay within computer science" restriction.

**Graph export**
Export the current map as PNG (screenshot of the canvas) or JSON (nodes + edges in a portable format). Enables sharing and backup.

**Onboarding / empty state**
Beyond the placeholder "Search a concept to get started" text, users need to understand the interaction model on first visit: what drilling does, what stitching does, what the edge colors mean.

**Undo / redo**
Accidental node deletions and edge additions are not recoverable today. A simple history stack for the most recent N operations would significantly reduce friction.

**Error UX**
API errors currently surface as `alert()` dialogs. Replace with dismissible toast notifications.

**Cache TTL / management**
The graph cache grows unbounded. Add a TTL (e.g. 30 days) or a "clear cache" option in settings.

---

## Phase 2 — Document-Grounded Exploration (RAG)

**Goal:** Let users ground the graph in a specific document rather than Claude's general world knowledge. The primary use case is academic and research reading — map the concepts in a paper before or while reading it.

**Why this matters:** Today Mental Map answers "what does Claude know about X?" Phase 2 answers "what does *this paper/book/spec* say about X?" The resulting graph is citable, reproducible, and specific to the source material. This is a genuine differentiator from every current PKM and graph tool.

### Proposed Features

**Document ingestion**
Upload a PDF, paste a URL, or provide markdown/plain text as a source. The document is parsed, chunked, and embedded locally (no document content leaves the machine). Sources are stored as a new entity type alongside maps.

**Source-scoped maps**
When a map has a linked source document, graph generation queries the document's embeddings for relevant context before calling Claude. Node descriptions include citations ("as described in section 3.2..."). Stitching also grounds bridge node suggestions in document content.

**Source management**
View, rename, and delete source documents. Multiple maps can reference the same source (e.g., multiple reading sessions of the same paper).

**Passage highlighting**
Click a citation in a node's detail panel to highlight (or scroll to) the relevant passage in a document viewer pane.

### Technical Prerequisites
- PDF parsing library
- Text chunking utility
- Embedding model (Anthropic API or local via `@xenova/transformers`)
- Vector similarity search (in-browser ANN or server-side)
- New Dexie schema version with `sources` and `chunks` tables

See [ARCHITECTURE.md](ARCHITECTURE.md) for the proposed data flow.

---

## Phase 3 — To Be Defined

Phase 3 scope will be determined after Phase 2 ships and real usage data is available. Candidates under consideration:

**Sharing and collaboration**
Read-only shareable map links. Requires a hosting layer (the current architecture is purely local). The simplest path is export-to-URL (JSON encoded in the link) for small maps.

**Community maps / templates**
Pre-built starter maps for common domains (e.g., "Machine Learning Fundamentals", "Options Trading Basics", "Constitutional Law Concepts"). These function as onboarding accelerators and demonstrate domain breadth.

**API access**
A developer API for generating concept graphs programmatically. Useful for embedding Mental Map's graph generation in other tools or workflows.

**Richer edge types**
Extend beyond blue/red to a richer relationship vocabulary: "is a prerequisite for", "is an example of", "contradicts", "was developed from", etc. Requires prompt and UI changes.

**People and influence graphs**
Explicit support for non-concept node types: people, organizations, historical events, artworks. The data model already supports arbitrary labels — this is primarily a prompt and UI affordance change (e.g., "search an artist or movement" mode vs. "search a concept" mode).

**Integration with reference managers**
Import from Zotero, Mendeley, or other reference managers so researchers can build maps directly from their existing library.

---

## Long-Horizon Ideas

These are not planned and may never be built, but are worth naming so they can inform early architectural decisions:

- Mobile native app (React Native + Three.js → gesture-heavy use case fits touchscreen well)
- Real-time collaboration (multi-cursor graph editing, requires backend)
- Spaced repetition integration (use the map as a review queue — nodes surface for review based on learning schedule)
- Graph diff / versioning (compare how your understanding of a domain evolved over time)
