# Proposal: Bulk Work Item Creation

## Why

"Break this feature into stories" is the single most common agent-planning pattern, but today it means N sequential `create-work-item` calls with manual parent wiring — slow, and half-done when one call fails. One action that creates an epic and its children (or a batch of siblings) in a single invocation makes decomposition atomic-ish and cheap.

## What Changes

- New `create-work-items` action: creates up to fifty issues in one call via Jira's bulk endpoint, optionally under a new `epic` (created first and wired as the parent) or an existing `parentKey`.
- Registration grows to forty-one actions; one new template (41 templates).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-work-item-actions`: one ADDED action requirement; MODIFIED registration and catalog-entity-resolution requirements (`create-work-items` is project-scoped).
- `jira-action-templates`: MODIFIED one-template-per-action requirement (41 templates).

## Impact

- `JiraClient`: `createIssuesBulk` (`POST /issue/bulk`, partial-failure reporting); new `createWorkItems.ts` action module reusing the field/rich-text/"me" machinery; `plugin.ts`; one template + `all.yaml`; fixture tests; README.
