# Proposal: Version, Component and Field Support

## Why

Releases and ownership live in Jira's standard `fixVersions`, `affectsVersions`, and `components` fields, but the actions only reach them through the raw `customFields` escape hatch — with no way to discover which versions or components exist in a project. Release-notes and triage agents need these first-class.

## What Changes

- `create-work-item` and `update-work-item` accept `fixVersions`, `affectsVersions`, and `components` (arrays of names, resolved by Jira); `get-work-item` returns them.
- New read actions `list-versions` and `list-components` (project-scoped, `projectKey` or `entityRef`), so agents can discover valid names.
- New write action `create-version` (project-scoped) for release automation.
- Registration grows to twenty-nine actions; one test template per new action (29 templates), with tables for the two list actions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-work-item-actions`: three ADDED action requirements (list-versions, list-components, create-version); MODIFIED registration (29 actions, read-only set grows by two), create-work-item, update-work-item, get-work-item, and catalog-entity-resolution (three more project-scoped actions) requirements.
- `jira-action-templates`: MODIFIED one-template-per-action requirement (29 templates, tables for the new list actions).

## Impact

- `JiraClient`: `listVersions`, `listComponents`, `createVersion` (resolving the project id), version/component handling in `toOptionalFields` and `getIssue`.
- New action modules for the three actions (catalog-aware like `list-issue-types`); edits to createWorkItem/updateWorkItem/getWorkItem.
- `plugin.ts` registration, templates + `all.yaml`, fixture tests, README.
