# Design: Remote Links

## Context

Jira remote issue links (`POST`/`GET /issue/{key}/remotelink`, same shape on both products) carry an `object` with `url` and `title`. The plugin's established one-module-per-topic action pattern and permission gating apply unchanged.

## Goals / Non-Goals

**Goals:** attach and read titled web links. **Non-Goals:** icons, status/resolved decoration, globalId-based dedup/update, deleting remote links.

## Decisions

- **D1 Client:** `addRemoteLink(issueKey, {url, title})` posts `{object: {url, title}}` and returns the created id; `getRemoteLinks(issueKey)` maps to `{id, title, url}` entries.
- **D2 Actions:** `add-remote-link` (write permission) and `get-remote-links` (read permission, readOnly attributes) in one `remoteLinks.ts` module; both output the issue's browse `url`.
- **D3 Templates:** two templates; `get-remote-links` renders a table with the Title cell linked to the remote link URL, plus a URL column.
- **D4 Testing:** msw client tests (request body, mapping, 404), registry-mock tests per scenario, fixture updates (31 templates), discovery test 31/15, boot smoke 31/31.

## Risks / Trade-offs

- [Duplicate links when re-run] → Accepted (Jira allows duplicates without a globalId); idempotency via globalId can come later if needed.

## Migration Plan

Additive; merge and restart.

## Open Questions

None.
