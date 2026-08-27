# Proposal: Remote Links

## Why

Issues gain most of their context from what they point at — a pull request, a Backstage entity page, a dashboard — but the actions cannot attach or read such web links. Remote links are the natural Backstage↔Jira glue, letting an agent (or a template) link a created issue back to the thing that triggered it.

## What Changes

- New `add-remote-link` action: attaches a titled web link to an issue (`POST /issue/{key}/remotelink`).
- New `get-remote-links` read action: lists an issue's remote links.
- Registration grows to thirty-one actions (fifteen read-only); one template per new action (31 templates), with a linked-title table for `get-remote-links`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-work-item-actions`: two ADDED action requirements; MODIFIED registration requirement.
- `jira-action-templates`: MODIFIED one-template-per-action requirement (31 templates, the new table).

## Impact

- `JiraClient`: `addRemoteLink`, `getRemoteLinks`; new action module `remoteLinks.ts`; `plugin.ts`; two templates + `all.yaml`; fixture tests; README.
