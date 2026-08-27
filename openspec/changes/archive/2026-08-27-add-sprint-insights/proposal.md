# Proposal: Sprint Work Item Views and Insights

## Why

Boards and sprints can be listed and issues moved into a sprint, but agents cannot see what a sprint contains, take items out of it, or answer "how is the sprint going?" without stitching together many raw searches. A sprint content view, a move-to-backlog counterpart, and a computed sprint summary close the day-to-day agile loop.

## What Changes

- New `list-sprint-work-items` read action: the issues of a sprint (same item shape as search, with page cursors).
- New `move-to-backlog` write action: moves issues out of sprints into the backlog (counterpart to `move-to-sprint`).
- New `get-sprint-insights` read action: sprint metadata plus a computed summary — total and completed item counts and per-status, per-type, and per-assignee breakdowns — for "summarize the sprint" asks.
- Registration grows to thirty-six actions (seventeen read-only); one template per new action (36 templates), with a table for the sprint items and a summary-plus-tables rendering for the insights.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-work-item-actions`: three ADDED action requirements; MODIFIED registration requirement.
- `jira-action-templates`: MODIFIED one-template-per-action requirement (36 templates, the new renderings).

## Impact

- `JiraClient`: `getSprint`, `listSprintIssues` (Agile API, offset paging, status category + assignee display name), `moveToBacklog`; insights aggregation in the action.
- New `sprintInsights.ts` action module (or extension of `agile.ts`); `plugin.ts`; three templates + `all.yaml`; fixture tests; README.
