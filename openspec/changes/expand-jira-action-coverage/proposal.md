# Proposal: Expand Jira Action Coverage

## Why

Agents driving Jira through the current thirteen actions still hit walls they cannot work around on their own: they cannot resolve a person's name to the account ID/username that `assignee` inputs require, cannot express or read issue relations beyond parent/child, only discover legal status transitions by failing, cannot touch the custom fields that real-world Jira instances depend on, and cannot reach sprints, worklogs, or watchers at all. Search and comment reads are also capped at their first page, and none of the write actions are gated by Backstage's permission framework, which becomes a requirement the moment the MCP surface is exposed to real users.

## What Changes

- New discovery/read actions: `search-users` (resolve display names to assignable identities), `list-transitions` (currently reachable statuses for an issue), `list-link-types` (available issue link relations), `list-fields` (field ids/names including custom fields), `get-worklogs`.
- New relation/collaboration write actions: `link-work-items` (blocks / relates to / duplicates …), `add-worklog`, `add-watcher`, `remove-watcher`.
- New agile actions on Jira's Agile REST API: `list-boards`, `list-sprints`, `move-to-sprint`.
- New `delete-work-item` action — the first with `destructive: true` attributes.
- Custom field support: a `customFields` pass-through input on `create-work-item`/`update-work-item`, and custom field selection/output on `get-work-item`.
- `get-work-item` additionally returns the issue's links.
- Pagination: `search-work-items` and `get-comments` accept a page cursor and report whether/how to fetch the next page.
- All actions are guarded by the Backstage permission framework (read/write/delete permissions registered via the permissions registry, authorized per-call with the caller's credentials, allow-by-default under the default policy).
- One new test software template per new action (26 templates total), following the established shape.

## Capabilities

### New Capabilities

None — all changes extend the existing action and template capabilities.

### Modified Capabilities

- `jira-work-item-actions`: thirteen ADDED action requirements (search-users, list-transitions, list-link-types, list-fields, link-work-items, get-worklogs, add-worklog, add-watcher, remove-watcher, list-boards, list-sprints, move-to-sprint, delete-work-item); MODIFIED registration requirement (twenty-six actions, updated read-only/destructive sets, permission gating); MODIFIED create/update (customFields), get-work-item (links + custom fields), search-work-items (pagination), get-comments (pagination) requirements.
- `jira-action-templates`: MODIFIED one-template-per-action requirement (twenty-six templates; list/table outputs for the new list-returning actions).

## Impact

- `plugins/jira-actions-backend/src/lib/JiraClient.ts`: new methods (user search, links, transitions list, fields, worklogs, watchers, delete, agile board/sprint operations) plus an Agile API base path (`/rest/agile/1.0`) alongside the versioned core API base; pagination plumbing for search and comments.
- `plugins/jira-actions-backend/src/actions/`: thirteen new action modules; edits to createWorkItem, updateWorkItem, getWorkItem, searchWorkItems, getComments.
- `plugins/jira-actions-backend/src/plugin.ts`: registers the new actions and the permission metadata (`coreServices.permissions` + `coreServices.permissionsRegistry`); new `src/permissions.ts` exporting the permission definitions.
- New dependency: `@backstage/plugin-permission-common` (already in the yarn workspace tree) for `createPermission`.
- `examples/jira-actions-templates/`: thirteen new template files plus `all.yaml`; fixture tests and README updated.
- Per-product behavior differences (Cloud vs Data Center) contained in `JiraClient`, as today.
