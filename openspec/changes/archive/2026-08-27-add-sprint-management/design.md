# Design: Sprint Management

## Context

The Agile API creates sprints with `POST /sprint` (`originBoardId`, name, optional dates/goal) and edits them with the partial `POST /sprint/{id}` — which also carries state transitions (`active`, `closed`), making start/complete just state updates. Jira enforces the lifecycle rules (one active sprint per board unless parallel sprints are on, dates required to start, only active sprints close); the actions propagate those errors rather than duplicating them.

## Goals / Non-Goals

**Goals:** the full sprint lifecycle (create → edit → start → complete). **Non-Goals:** sprint deletion, parallel-sprint configuration, moving incomplete issues on completion (Jira's default backlog behavior is kept).

## Decisions

- **D1 Client:** `createSprint({boardId, name, startDate?, endDate?, goal?})` posts with `originBoardId`; `updateSprint(sprintId, {name?, goal?, startDate?, endDate?, state?})` uses the partial `POST /sprint/{id}` and maps the response through the existing sprint shape. Start and complete are `updateSprint` calls with `state: 'active' | 'closed'`.
- **D2 Actions:** four write registrations in the agile module: `create-sprint`, `update-sprint` (at-least-one-field validation in the handler), `start-sprint` (optional dates forwarded with the activation), `complete-sprint`. All return the resulting sprint fields.
- **D3 Templates:** four plain result templates mirroring the inputs.
- **D4 Testing:** msw tests for the create body (`originBoardId`) and partial-update bodies (goal-only, state transitions), registry-mock tests per scenario (including the no-fields validation and Jira rejections), fixture/discovery updates (40 templates/actions), boot smoke 40/40.

## Risks / Trade-offs

- [Lifecycle rules live in Jira] → Deliberate: propagating Jira's errors avoids re-implementing board configuration awareness.

## Migration Plan

Additive; merge and restart.

## Open Questions

None.
