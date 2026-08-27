# Design: Discovery Caching

## Context

Link types and fields are instance-level, change rarely, and are fetched repeatedly — `link-work-items` re-fetches link types on every call for its name/direction resolution. All requests already flow through `JiraClient`, whose instances are per-invocation, so the cache must outlive the client.

## Goals / Non-Goals

**Goals:** transparent 60s caching for the two instance-level discovery fetches, per host. **Non-Goals:** caching project-scoped reads (versions, components, issue types — cheap and more change-prone), cache invalidation APIs, distributed caching.

## Decisions

- **D1 `TtlCache`** (`lib/cache.ts`): a tiny `get`/`set` map with per-entry expiry, `ttlMs` and an injectable `now` clock (for expiry tests). One instance is created in `plugin.ts` at init and lives for the backend's lifetime.
- **D2 Client integration:** `new JiraClient(connection, { cache? })`; when present, `listLinkTypes` and the raw field-catalog fetch behind `listFields` read/write keys `linkTypes:<host>` and `fields:<host>`. The `list-fields` name filter runs after the cache, so the unfiltered catalog is cached once. Clients without a cache behave exactly as before.
- **D3 Wiring:** only the registrations that benefit get the cache — `list-fields`, `list-link-types`, and `link-work-items` — keeping the touch surface to two modules; tests construct a fresh cache per registry so cases stay isolated.
- **D4 Testing:** msw call-counting tests for hit, `link-work-items` reuse, expiry (injected clock), and host separation; existing no-cache tests stay untouched.

## Risks / Trade-offs

- [Sixty seconds of staleness on link types/fields] → Both change through admin actions, not agent flows; the TTL bounds it tightly.

## Migration Plan

Behavior-only; merge and restart.

## Open Questions

None.
