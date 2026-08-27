# Design: Bulk Work Item Creation

## Context

Jira's `POST /issue/bulk` (both products, ≤50 entries) takes `{issueUpdates: [{fields}, …]}` and returns `{issues: [{id, key}], errors: [{failedElementNumber, elementErrors}]}` — entries can fail individually while others are created. The epic-then-children pattern needs the epic's key before the bulk call, so it is one `createIssue` followed by one bulk call.

## Goals / Non-Goals

**Goals:** one-call decomposition (epic + children, or a sibling batch), reusing every existing field/rich-text/`me` mechanism. **Non-Goals:** transactional rollback of partially created batches (the error reports what was created); bulk updates/transitions; cross-project batches.

## Decisions

- **D1 Client:** `createIssuesBulk(requests: JiraCreateWorkItemRequest[])` builds each entry's fields exactly as `createIssue` does (shared private helper) and posts once. Any `errors` entry fails the call with an `InputError`-style message naming the failed element numbers and Jira's per-field details, plus the keys of issues that were created; on success it returns `{id, key, url}[]` in input order.
- **D2 Action:** `create-work-items` (write permission, not idempotent) validates the `epic`/`parentKey` conflict, resolves the project (catalog-aware) and any `me` assignees (per unique value), creates the epic first when given (`issueType` defaulting to `Epic`), then bulk-creates the items with the resolved parent key. Output: `items` in input order plus optional `parent`.
- **D3 Template:** the `items` parameter is an array of objects (issueType, summary, description) — RJSF renders nested object arrays; `epic` is an object parameter; entity picker as usual.
- **D4 Testing:** msw tests for the bulk body, input-order mapping, and partial-failure error (created keys named); registry-mock tests for epic+children (two requests, parent wired), parentKey batch, conflict validation, and partial failure; fixture/discovery updates (41), boot smoke 41/41.

## Risks / Trade-offs

- [Not transactional] → Jira's bulk endpoint simply is not; the failure message lists created keys so the caller can clean up or retry the rest.
- [Epic hierarchies vary (next-gen vs classic)] → The parent field works on team-managed projects and modern company-managed hierarchies; where an instance still needs the legacy epic-link custom field, `customFields` on the items covers it.

## Migration Plan

Additive; merge and restart.

## Open Questions

None.
