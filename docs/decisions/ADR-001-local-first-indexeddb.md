# ADR-001: Local-First Architecture with IndexedDB

**Date:** 2026-03-08
**Status:** Accepted

---

## Context

Mental Map needs persistent storage for nodes, edges, maps, cache, and stitch history. The options at the time of the decision were:

1. **Server-side database** (Postgres, SQLite on a backend server, Supabase, Firebase, etc.)
2. **localStorage** (browser key-value, ~5MB limit, synchronous)
3. **IndexedDB** (browser structured storage, large quota, async, queryable)
4. **In-memory only** (no persistence, state lost on refresh)

The product is a single-user exploration tool. There are no multi-user requirements in Phase 1 or Phase 2. The data is personal and potentially sensitive (user's research topics, notes, reading interests).

---

## Decision

All persistent data lives in **browser IndexedDB**, accessed via **Dexie.js** as the abstraction layer. There is no server-side database. No user data is stored by Mental Map's infrastructure — only Anthropic API calls leave the machine (concept strings and node labels, not user notes or map structure).

---

## Rationale

**Privacy by default.** Users do not need to create an account or trust a backend with their intellectual trail. Their reading interests, research domains, and personal notes stay on their machine.

**No backend to run.** The entire application runs from `npm run dev`. There is no Postgres to spin up, no migration runner, no auth layer. This reduces onboarding friction to near zero and eliminates hosting costs.

**Sufficient for single-user use.** IndexedDB supports multi-table schemas, range queries, transactions, and stores well into the gigabyte range — more than enough for thousands of nodes and edges.

**Dexie.js** provides typed tables, async/await API, and a clean migration system (`.version().stores().upgrade()`). The migration history in `db.ts` (v1 through v5) demonstrates that schema evolution is manageable without a separate migration runner.

**Cache is free.** The `graphCache` table stores AI API responses so repeated searches are instant and free. A server-side cache would require infrastructure; IndexedDB makes this a one-liner.

---

## Consequences

**Positive:**
- Zero backend infrastructure
- Privacy-preserving by default
- Instant setup
- Works offline (except for AI generation calls)

**Negative:**
- No sync across devices or browsers — a user's maps on Chrome on their laptop are not available on Firefox or their phone
- No backup unless the user manually exports (export is not yet implemented)
- Data is tied to browser profile; clearing browser data destroys all maps
- Multi-user collaboration requires a different architecture entirely

**Accepted tradeoffs:** The sync and backup limitations are real. They will need to be addressed in Phase 3 if the product grows beyond single-user use. Export (JSON download) should be added in Phase 1 completion as a mitigation.
