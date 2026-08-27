# Proposal: Sprint Management

## Why

Sprints can be listed, inspected, filled, and summarized — but not created, started, completed, or edited. An agent planning an iteration still needs a human for the sprint lifecycle itself.

## What Changes

- New write actions: `create-sprint` (on a board, with optional dates and goal), `update-sprint` (rename, re-date, or change the goal), `start-sprint` (activate, with optional dates), and `complete-sprint` (close).
- Registration grows to forty actions; one template per new action (40 templates).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-work-item-actions`: four ADDED action requirements; MODIFIED registration requirement.
- `jira-action-templates`: MODIFIED one-template-per-action requirement (40 templates).

## Impact

- `JiraClient`: `createSprint` and a partial `updateSprint` (also carrying the start/close state changes); four registrations in the agile module; `plugin.ts`; four templates + `all.yaml`; fixture tests; README.
