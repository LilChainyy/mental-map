# Product Requirements Document — Mental Map

**Version:** 0.1
**Last updated:** 2026-03-08
**Status:** Living document

---

## 1. Problem Statement

Learning something new is slow and disorienting. Whether you're a software engineer crossing into finance, a biology student encountering legal frameworks for biotech IP, or a humanities researcher trying to understand machine learning — the standard approach (read articles, watch lectures, take notes) rarely makes the *structure* of a knowledge domain legible. You accumulate fragments without seeing how they relate.

Existing tools solve the wrong problem. Note-taking apps (Obsidian, Logseq, Roam) are powerful but require you to already know the domain well enough to build the graph manually — over weeks or months. Wikipedia gives you words without spatial structure. LLM chat is a stream, not a map.

**The core insight:** what learners need first is not depth — it is *orientation*. A map of the territory before they walk into it.

---

## 2. Vision

Mental Map makes any knowledge domain immediately navigable. You type a concept, and within seconds you see how it sits within a network of related and contrasting ideas — in three-dimensional space you can explore, expand, and annotate. The map grows as you drill into it. AI stitches together concepts you explore separately, surfacing unexpected connections.

The long-term vision is that Mental Map becomes the default starting point for learning anything: before you read a paper, before you enter a codebase, before you study for an exam — you orient yourself with a map.

---

## 3. Target Users

### Primary — The Domain Crosser

A professional or advanced student who regularly encounters knowledge domains adjacent to their own. They are intellectually curious, time-constrained, and want to build a working mental model of an unfamiliar field without committing to a months-long reading program.

**Examples:** A software engineer exploring quantitative finance. A biologist navigating patent law for a startup. A philosopher trying to understand information theory. A finance analyst reading about transformer architectures.

**Pain point:** They can't orient themselves quickly. They don't know which concepts matter, how they relate, or which are in tension with each other.

**What they need from Mental Map:** Fast orientation — the key nodes, the key connections, the vocabulary — before going deeper.

### Secondary — The Active Learner

A student or self-directed learner who is working through a structured body of knowledge (a course, a textbook, a field) and wants a spatial, explorable representation of what they're learning. They use the map as an active thinking tool: annotating nodes, building multiple maps per subject, drilling into unfamiliar terms as they appear.

**Pain point:** Linear learning (reading, watching) doesn't build relational understanding. Concepts don't "stick" without knowing where they fit.

**What they need from Mental Map:** A persistent, explorable map they build up session over session, not a one-shot summary.

### Phase 2 — The Paper Reader

A researcher, PhD student, or technical practitioner who has a specific document (research paper, technical spec, legal filing, book chapter) and wants to map the conceptual structure of that document before or while reading it.

**Pain point:** Dense academic papers assume prior vocabulary. Readers get lost in forward references and undefined terms.

**What they need from Mental Map:** A graph grounded in the actual content of their document — nodes citing specific passages, relationships derived from what the author actually argues, not what Claude knows in general.

---

## 4. Non-Target Users

- **PKM power users** with mature Obsidian/Roam vaults who have already solved personal knowledge organization. They need curation, tagging, backlinks — not AI-generated graphs.
- **Teams / enterprises** seeking collaborative knowledge management. Multi-user sync and access control are out of scope for the current phase.
- **Casual general-audience users** who want quick answers rather than deep orientation. A chat interface serves them better.

---

## 5. Core Value Propositions

1. **Speed of orientation** — concept graph in seconds, not weeks of reading
2. **Spatial cognition** — 3D navigation leverages spatial memory in a way flat text cannot
3. **Serendipitous discovery** — cross-cluster stitching surfaces connections you wouldn't have found by reading linearly
4. **Local-first privacy** — all your maps stay on your machine; API calls go to Anthropic but no map data is stored server-side
5. **Compounding value** — maps grow richer the more you drill; prior searches are cached so returning to a concept is instant

---

## 6. Feature Inventory (Phase 1 — Current)

### Graph Generation
- Search any concept → AI generates 8–15 related nodes with descriptions and typed edges
- Edge types: blue (related/complementary) and red (contrasting/conflicting)
- Node visual weight scales with connection count (sphere size, label size, opacity)
- Results cached in IndexedDB; re-searching a concept is instant

### Drill-Down Exploration
- Double-click any node → expand that node as a new concept, merging the resulting subgraph into the current map
- Camera fly-to animation on new center node
- Deduplication: if a concept already exists in the map it is reused, not duplicated

### Cross-Cluster Stitching
- AI analyzes disconnected clusters and suggests cross-cluster edges with reasoning
- AI may synthesize 1–3 "bridge nodes" — concepts that naturally link distant clusters
- User-deleted stitched edges are remembered and excluded from future stitch runs
- Stitch triggers a physics simulation reheat so clusters drift together visually

### Multi-Map Workspace
- Create, rename, and delete multiple named maps
- Each map is fully isolated (nodes, edges, stitch history)
- Last active map persisted in localStorage

### Node Management
- Add nodes manually (label, description, color)
- Edit node label, description, notes, color, links
- Delete node (removes connected edges)
- Add edges manually between any two nodes
- User-edited nodes are flagged so AI updates don't overwrite manual changes

### Hand Gesture Navigation
- MediaPipe HandLandmarker runs at 30fps via webcam
- Point (index extended): orbit camera
- Spread (thumb + index distance): zoom
- Pinch (thumb + index close): pan; hold still 500ms to select highlighted node
- Picture-in-picture overlay shows finger tracking visualization
- Graceful fallback if camera access is denied

### UI / UX
- Search bar (keyboard shortcut `/`)
- Toolbar: new node, stitch, map switcher, hand tracking toggle
- Detail panel: node metadata, edit in place, linked resources
- Depth-based label fading (far nodes dim, near nodes are bright)
- Loading/generating overlay with status text

### Known Phase 1 Gaps (tracked in Roadmap)
- System prompts are hardcoded to CS/software engineering; data model is domain-agnostic but prompts need updating
- No graph export (PNG, JSON, shareable link)
- No onboarding / empty state guidance beyond placeholder text
- No undo/redo

---

## 7. Out of Scope

The following are explicitly not in scope for Phase 1 or Phase 2 and should not drive architectural decisions:

- Real-time collaboration or multi-user maps
- Cloud sync or account system
- Mobile native app
- Graph querying / filtering by node properties
- Versioning / history of map states
- Integration with third-party tools (Notion, Obsidian, Roam, Zotero)

---

## 8. Phase Definitions

### Phase 1 — Foundation (Current)
AI-generated concept maps from Claude's world knowledge. Multi-map workspace. Cross-cluster stitching. Hand gesture navigation. Local persistence. Domain-agnostic prompts (in progress).

### Phase 2 — Document-Grounded Exploration (RAG)
User uploads a source document (PDF, paper, markdown, URL). The graph is generated from the content of that document, not from Claude's general world knowledge. Nodes cite specific passages. Relationships reflect what the author argues, not general consensus. This makes the tool valuable for:
- Reading a research paper before you understand its vocabulary
- Mapping a legal document's argument structure
- Exploring a codebase's module relationships
- Studying from a textbook chapter

**Architectural implications:** Document ingestion pipeline (parse → chunk → embed), vector search over chunks, context injection into generation prompts, passage citation in node descriptions.

### Phase 3 — To Be Defined
Candidates include: sharable map links (read-only), community-contributed concept maps, API access for developers, graph export formats, integration with reference managers (Zotero). These will be defined based on Phase 1 and Phase 2 learnings.

---

## 9. Success Metrics

At this stage the product is pre-launch. Candidate metrics for Phase 1 validation:

- **Retention signal:** do users return to the same map across sessions (indicates the map is valuable beyond initial curiosity)?
- **Depth signal:** average drill-down depth per session (how many times do users expand into new concepts)
- **Stitch usage:** do users run Stitch, and do they keep the resulting edges (stitch quality proxy)
- **Multi-map signal:** do users create more than one map (indicates repeated use across domains)

---

## 10. Constraints

- **API dependency:** Graph generation requires an Anthropic API key and consumes tokens. High-volume use has real cost implications. The graph cache (IndexedDB) mitigates this for repeated searches.
- **Browser-only:** No server infrastructure beyond the dev/prod Vite server. All persistence is client-side.
- **Camera requirement for hand tracking:** Hand tracking requires webcam access. It is an enhancement, not a core path.
- **Single-user:** The current data model has no user ID concept; everything is local to a single browser profile.
