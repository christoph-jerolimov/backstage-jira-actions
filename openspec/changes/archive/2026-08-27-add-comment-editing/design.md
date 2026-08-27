# Design: Comment Editing

## Context

Jira comment editing is `PUT /issue/{key}/comment/{id}` with the same rich-text body shape as posting (ADF on Cloud v3, string on Data Center v2) and deletion is `DELETE` on the same path. The plugin's rich-text helpers (`toWriteValue`), permission gating, and action-module patterns apply unchanged.

## Goals / Non-Goals

**Goals:** replace a comment body; delete a comment (destructive, delete permission). **Non-Goals:** comment visibility/restriction properties; editing authorship or timestamps; worklog editing.

## Decisions

- **D1 Client:** `updateComment(issueKey, commentId, body, bodyFormat)` writes via `toWriteValue`; `deleteComment(issueKey, commentId)` expects 204.
- **D2 Actions:** one `commentEditing.ts` module. `update-comment` mirrors `add-comment`'s body/bodyFormat contract with the write permission; `delete-comment` is `destructive: true` under the delete permission — the discovery test's destructive set becomes the two delete actions.
- **D3 Templates:** two plain result templates (update-comment carries the bodyFormat enum, quoted body pass-through like add-comment).
- **D4 Testing:** msw client tests (body conversion, 204 delete, 404), registry-mock tests per scenario incl. an ADF-format update, fixture/discovery updates (33 templates, destructive pair), boot smoke 33/33.

## Risks / Trade-offs

- [Editing others' comments depends on Jira permissions] → Jira enforces; 403s propagate as NotAllowed.

## Migration Plan

Additive; merge and restart.

## Open Questions

None.
