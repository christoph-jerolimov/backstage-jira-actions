# Design: Assignee Conveniences

## Context

Jira clears an assignee only with an explicit `fields.assignee = null`. Backstage credentials expose the caller's user entity ref for user principals; the catalog User entity carries `spec.profile.email`; the existing `searchUsers` client method matches emails on both products. `create-work-item` already has a catalog dependency; `update-work-item` and the watcher actions gain one.

## Goals / Non-Goals

**Goals:** `me` on the four identity inputs; `unassign` on update. **Non-Goals:** arbitrary display-name resolution in identity inputs (use `search-users` explicitly); per-connection identity mapping config.

## Decisions

- **D1 Resolution helper** (`lib/selfUser.ts`): `resolveJiraUser({client, catalog, credentials, value})` — returns `value` unchanged unless it equals `me` case-insensitively. For `me`: require `credentials.principal.type === 'user'` (else InputError), fetch the user entity by ref with the caller's credentials (NotFound → error naming the ref), read `spec.profile.email` (missing → error naming the entity), `client.searchUsers(email)` and pick the exact case-insensitive email match, falling back to a single-result match; none/ambiguous → error naming the email.
- **D2 Unassign:** `JiraWorkItemFields` gains `unassign?: boolean`; `toOptionalFields` emits `assignee: null` when set. The action validates the `assignee`/`unassign` conflict before any call and counts `unassign` as updatable.
- **D3 Wiring:** update-work-item and both watcher actions take `catalog` (plugin.ts passes it); the resolution happens after the permission check and before the Jira write. A literal value skips catalog and search entirely, so existing behavior is untouched.
- **D4 Testing:** helper-level cases via registry-mock tests with `catalogServiceMock` (User entity with profile email) and msw user-search handlers: assign-to-me on create and update, watch-as-me, no-match error, service-caller error (mock service credentials), unassign body, conflict validation. Template: update-work-item gains the `unassign` boolean parameter (fixture pass-through covers it).

## Risks / Trade-offs

- [`me` could collide with a real username] → Accepted: matched case-insensitively as a reserved word and documented; real "me" usernames are vanishingly rare and `search-users` output can always be passed literally.
- [Email visibility can be restricted on Cloud] → The exact-match falls back to a single-result match; otherwise the error tells the caller to pass an explicit id.

## Migration Plan

Additive; merge and restart.

## Open Questions

None.
