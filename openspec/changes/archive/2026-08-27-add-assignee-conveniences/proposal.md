# Proposal: Assignee Conveniences (unassign and "me")

## Why

An agent acting for a user cannot say "assign this to me" — every identity input needs a pre-resolved account ID or username — and `update-work-item` can set an assignee but never clear one, since Jira requires an explicit `null` for that. "Take this ticket" and "put it back in the pool" should be one-step asks.

## What Changes

- The identity inputs — `assignee` on `create-work-item`/`update-work-item` and `user` on `add-watcher`/`remove-watcher` — accept the special value `me`, resolved to the invoking user's Jira identity via their catalog profile email and Jira user search.
- `update-work-item` gains an `unassign` boolean (counts as an updatable field, conflicts with `assignee`) that clears the assignee.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-work-item-actions`: one ADDED requirement (self identity resolution for `me`); MODIFIED update-work-item requirement (`unassign`).

## Impact

- New `lib/selfUser.ts` resolution helper (credentials → catalog user entity → profile email → Jira user search); `JiraClient` unassign support in `toOptionalFields`.
- `update-work-item`, `add-watcher`, `remove-watcher` gain a catalog dependency (create already has one); `plugin.ts` wiring.
- `update-work-item` template gains the `unassign` parameter; README notes.
