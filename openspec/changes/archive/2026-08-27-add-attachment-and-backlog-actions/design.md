# Design: Attachment Reads, Idempotent Remote Links, and Backlog View

## Context

Three independent leftovers sharing existing seams. Attachments come back on the issue itself (`fields=attachment`: id, filename, size, mimeType, `content` download URL, author, created — same shape on both products). Jira's remote-link `POST` upserts when the body carries a `globalId`, and `GET` returns it per link. The board backlog is `GET /rest/agile/1.0/board/{id}/backlog` with the same `startAt`/`total` paging as the sprint issue list.

## Goals / Non-Goals

**Goals:** attachment metadata reads; duplicate-free remote links for re-running agents; the backlog counterpart to the sprint content view. **Non-Goals:** attachment upload/download/delete (binary payloads are impractical over MCP), remote-link deletion, backlog ranking/reordering.

## Decisions

- **D1 Attachments:** `getAttachments(issueKey)` requests the issue with `fields=attachment` and maps to `{id, filename, downloadUrl (content), size?, mimeType?, author? (displayName), created?}`; the `get-attachments` action (read permission, readOnly) wraps it with the issue `url`.
- **D2 Remote links:** `addRemoteLink` gains `globalId?` (sent at the body's top level next to `object`); `getRemoteLinks` maps `globalId` through when present. The action inputs/outputs mirror this; behavior without a `globalId` is unchanged.
- **D3 Backlog:** `listBacklogIssues(boardId, {maxResults, pageToken?})` reuses the offset-token helpers and the search-item mapping (as `listSprintIssues` does); `list-backlog-work-items` (read permission) mirrors `list-sprint-work-items` exactly, registered in the agile module.
- **D4 Templates:** `get-attachments` renders Filename (linked to the download URL) | Size | Type | Author; `list-backlog-work-items` reuses the work-items table; the `add-remote-link` template gains the `globalId` parameter.
- **D5 Testing:** msw client tests (attachment mapping, upsert body with `globalId`, backlog paging), registry-mock tests per scenario, fixture/discovery updates (43 templates/actions, 19 read-only), examples for the two new actions, boot smoke 43/43.

## Risks / Trade-offs

- [Attachment download URLs require Jira credentials to fetch] → Stated in the field description; agents relay the URL to humans rather than fetching it.
- [Backlog endpoint requires a scrum/kanban board with a backlog view] → Boards without one return Jira errors, which propagate as usual.

## Migration Plan

Additive; merge and restart.

## Open Questions

None.
