# Design: Sprint Work Item Views and Insights

## Context

The Agile API (same path on both products) serves `GET /sprint/{id}` (metadata), `GET /sprint/{id}/issue` (`startAt`/`maxResults`/`total` paging, standard issue fields), and `POST /backlog/issue` (move out of sprints). Status categories (`fields.status.statusCategory.key === 'done'`) distinguish completed work product-independently; assignee display names come from the same issue payloads.

## Goals / Non-Goals

**Goals:** sprint content listing with the established cursor contract; backlog counterpart to move-to-sprint; a server-computed sprint summary agents can render or narrate directly. **Non-Goals:** story-point/velocity math (custom-field dependent), burndown history, board configuration.

## Decisions

- **D1 Client:** `getSprint(sprintId)` maps to the existing `JiraSprint` shape; `listSprintIssues(sprintId, {maxResults, pageToken?})` uses the shared offset-token helpers and returns search items plus, per item, the raw `statusCategory` key and assignee `displayName` (a `JiraSprintIssue` extending `JiraSearchItem`) so insights need no second fetch shape; `moveToBacklog(issueKeys)` posts `{issues}`.
- **D2 Insights aggregation** lives in the action: page through `listSprintIssues` (page size 100) up to 500 items, count total/done (statusCategory `done`), and build `{name, count}` breakdowns for status, issue type, and assignee display name (`Unassigned` fallback), sorted by descending count then name.
- **D3 Actions:** `list-sprint-work-items` and `get-sprint-insights` (read permission, readOnly), `move-to-backlog` (write, idempotent) — added to the agile/sprint modules.
- **D4 Templates:** sprint items reuse the search-items table; insights render summary lines plus three Name/Count tables; move-to-backlog takes the `issueKeys` array parameter.
- **D5 Testing:** msw tests for the three endpoints (paging, statusCategory mapping, backlog body), registry-mock tests per scenario (insights aggregation over a mixed fixture, empty sprint, 404s), fixture/discovery updates (36 templates, 17 read-only), boot smoke 36/36.

## Risks / Trade-offs

- [500-item bound on insights] → Logged in the output implicitly via totalItems; sprints beyond 500 items are far outside normal use.
- [Done-detection relies on status categories] → Standard on both products; statuses without a category count as not done.

## Migration Plan

Additive; merge and restart.

## Open Questions

None.
