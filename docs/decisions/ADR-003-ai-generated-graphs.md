# ADR-003: AI-Generated Graphs vs. Manual Graph Construction

**Date:** 2026-03-08
**Status:** Accepted

---

## Context

A knowledge graph tool can ask users to build graphs manually (as Obsidian, Roam, and Logseq do), generate them algorithmically from structured data sources, or generate them using a large language model. Mental Map had to choose a primary graph construction strategy.

Options:
1. **Manual construction** — user creates nodes and edges themselves
2. **Structured data import** — import from Wikipedia categories, ontologies (DBpedia, Wikidata), or citation graphs
3. **LLM-generated** — prompt an LLM to generate the graph structure from a concept string
4. **Hybrid** — AI-generated baseline, user-editable

---

## Decision

Mental Map is primarily **AI-generated with user editing as a first-class affordance**. The LLM (Claude) generates the initial graph and all drill-down expansions. Users can add nodes/edges manually, edit any node's content, color-code nodes, delete anything they don't want, and write personal notes — but they are not expected to build graphs from scratch.

---

## Rationale

**The core problem is time-to-first-value.** The competitive insight against tools like Obsidian is that Obsidian requires domain expertise to build a good graph — you have to know what nodes to create and how they relate. Mental Map's value proposition is that you get a useful graph *before* you have that expertise. An LLM can generate a reasonable concept map of "convertible notes" or "CRISPR mechanisms" or "Byzantine fault tolerance" in seconds. A user cannot.

**LLMs are well-suited to this task.** Graph generation is a constrained JSON output task with a well-defined schema. Claude reliably produces valid graphs with accurate node descriptions and meaningful typed edges across a wide range of knowledge domains. The structured output (JSON with explicit `nodes` and `edges` arrays) is easy to validate and deterministic enough for production use.

**Manual editing preserves agency.** Users can reject AI nodes they don't find useful, add domain-specific nodes the AI missed, correct errors in descriptions, annotate with personal notes, and color-code by theme. The `isUserEdited` flag ensures user changes are not silently overwritten by future AI updates to the same node.

**Structured data sources were rejected** because they require either: (a) a live API dependency (Wikidata, Wikipedia) with its own reliability, rate limiting, and schema constraints, or (b) a bundled knowledge base (too large for a browser-local tool). LLMs provide flexible, domain-agnostic coverage with no external data dependency beyond the API call.

---

## Consequences

**Positive:**
- Zero-friction first graph — users have a rich starting point in seconds
- Works across any knowledge domain with no domain-specific data pipeline
- AI naturally produces relationship descriptions ("X uses Y", "X is an alternative to Z") that would require curation in a structured source
- The stitch feature is only possible with an LLM — no ontology-based approach could synthesize bridge nodes across disparate clusters

**Negative:**
- **AI hallucination risk:** Generated node descriptions may be subtly inaccurate, especially for niche or rapidly-evolving topics. The graph should be understood as a starting orientation, not a verified reference. This should be communicated in the UI.
- **API cost:** Every search and drill-down costs tokens. The graph cache mitigates repeat searches, but heavy first-time exploration is expensive.
- **CS prompt hardcoding:** The current system prompts restrict generation to computer science. This is a Phase 1 completion item — the architecture supports any domain but the prompts do not yet reflect this.
- **Non-determinism:** Two searches for the same concept may produce slightly different graphs (the cache mitigates this after the first call, but different users or cache-cleared sessions may see different results).

**Mitigations planned:**
- Caveat text in the UI noting that AI-generated content should be verified for critical use
- Domain-agnostic prompt update (Phase 1 completion)
- Graph export so users can save and share verified graphs independently of regeneration
