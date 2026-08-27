# Proposal: Attachment Reads, Idempotent Remote Links, and Backlog View

## Why

Three small, real gaps remain in the otherwise complete action surface: attachments on an issue are invisible to agents (the last commonly-needed read), re-running `add-remote-link` duplicates links because nothing identifies them, and planning flows can see a sprint's content but not the board backlog they would pull from.

## What Changes

- New `get-attachments` read action: an issue's attachments with filename, size, type, author, and download URL (metadata only — no upload, which is impractical over MCP).
- `add-remote-link` gains an optional `globalId`: Jira upserts remote links by global id, so re-runs update instead of duplicating; `get-remote-links` returns each link's `globalId` when present.
- New `list-backlog-work-items` read action: the backlog of a board, mirroring `list-sprint-work-items` (same item shape and page cursors).
- Registration grows to forty-three actions (nineteen read-only); one template per new action (43 templates), the remote-link template gains the `globalId` parameter.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-work-item-actions`: two ADDED action requirements; MODIFIED add-remote-link, get-remote-links, and registration requirements.
- `jira-action-templates`: MODIFIED one-template-per-action requirement (43 templates, two new tables).

## Impact

- `JiraClient`: `getAttachments` (via the issue's `attachment` field), `globalId` pass-through on `addRemoteLink`/`getRemoteLinks`, `listBacklogIssues` (Agile API, offset cursor).
- New `attachments.ts` action module; backlog registration in the agile module; `plugin.ts`; two templates + `all.yaml`; fixture tests; README.
