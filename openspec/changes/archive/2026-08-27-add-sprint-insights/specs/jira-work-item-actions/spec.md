# jira-work-item-actions Delta

## ADDED Requirements

### Requirement: List sprint work items action

The system SHALL provide a `list-sprint-work-items` action that lists the issues of a sprint via Jira's Agile API. The input SHALL accept `sprintId` (required), `maxResults` (default 50, capped at 100), `pageToken` (optional cursor from a previous invocation), and `host` (optional). On success, the output SHALL include an `items` array — each item with `key`, `summary`, `status`, `issueType`, `url`, and `assignee` when present, as in `search-work-items` — and a `nextPageToken` cursor when more items remain.

#### Scenario: List the issues of a sprint

- **WHEN** the action is invoked with an existing sprint's id
- **THEN** the output lists the sprint's issues with key, summary, status, type, and URL

#### Scenario: Fetch the next page of sprint items

- **WHEN** a listing returns a `nextPageToken` and the action is invoked again with it as `pageToken`
- **THEN** the next page of items is returned, and `nextPageToken` is absent once no further items remain

#### Scenario: Sprint does not exist

- **WHEN** the action is invoked with an unknown sprint id
- **THEN** the action fails with a NotFound-style error naming the sprint id

### Requirement: Move to backlog action

The system SHALL provide a `move-to-backlog` action that moves issues out of their sprints into the backlog via Jira's Agile API. The input SHALL accept `issueKeys` (required: a non-empty list of at most 50 issue keys) and `host` (optional). On success, the output SHALL include the moved `issueKeys`.

#### Scenario: Move issues to the backlog

- **WHEN** the action is invoked with issue keys that are in a sprint
- **THEN** those issues are moved to the backlog and the output reports the keys

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with an error that includes Jira's error details

### Requirement: Sprint insights action

The system SHALL provide a `get-sprint-insights` action that summarizes a sprint. The input SHALL accept `sprintId` (required) and `host` (optional). The action SHALL read the sprint's metadata and all of its issues (bounded at 500 items) and compute the summary server-side. On success, the output SHALL include:

- `sprint`: the sprint `id`, `name`, and, when present, `state`, `startDate`, `endDate`, and `goal`.
- `totalItems`: the number of issues in the sprint.
- `completedItems`: the number of issues whose status category is done.
- `byStatus`, `byIssueType`, `byAssignee`: arrays of `{ name, count }` breakdowns, ordered by descending count; unassigned issues appear under the name `Unassigned`, and assignees appear by display name.

#### Scenario: Summarize a sprint

- **WHEN** the action is invoked with an existing sprint's id
- **THEN** the output contains the sprint metadata, the total and completed counts, and the status/type/assignee breakdowns

#### Scenario: Empty sprint

- **WHEN** the action is invoked for a sprint with no issues
- **THEN** the output reports zero totals and empty breakdowns

#### Scenario: Sprint does not exist

- **WHEN** the action is invoked with an unknown sprint id
- **THEN** the action fails with a NotFound-style error naming the sprint id

## MODIFIED Requirements

### Requirement: Jira actions are registered in the Actions Registry

The system SHALL register the Jira work item actions in the Backstage Actions Registry under the `jira-actions` plugin, so that they are discoverable and invokable through the actions service, and exposed via the MCP actions backend when the `jira-actions` plugin is listed in `backend.actions.pluginSources`. The registered actions SHALL be `create-work-item`, `update-work-item`, `rename-work-item`, `set-work-item-parent`, `delete-work-item`, `get-work-item`, `search-work-items`, `search-users`, `add-comment`, `get-comments`, `update-comment`, `delete-comment`, `add-label`, `remove-label`, `add-remote-link`, `get-remote-links`, `link-work-items`, `list-link-types`, `list-transitions`, `transition-work-item`, `list-projects`, `list-issue-types`, `list-fields`, `list-versions`, `list-components`, `create-version`, `get-worklogs`, `add-worklog`, `add-watcher`, `remove-watcher`, `list-boards`, `list-sprints`, `list-sprint-work-items`, `get-sprint-insights`, `move-to-sprint`, and `move-to-backlog`. Each action SHALL declare a title, a description, and typed input and output schemas so that callers (including AI agents) can discover how to use it without external documentation. The purely reading actions (`get-work-item`, `search-work-items`, `search-users`, `get-comments`, `get-remote-links`, `list-link-types`, `list-transitions`, `list-projects`, `list-issue-types`, `list-fields`, `list-versions`, `list-components`, `get-worklogs`, `list-boards`, `list-sprints`, `list-sprint-work-items`, `get-sprint-insights`) SHALL be marked read-only in their registry attributes. `delete-work-item` and `delete-comment` SHALL be the only actions marked destructive.

#### Scenario: Actions are discoverable

- **WHEN** the backend starts with the Jira actions plugin installed and `jira-actions` listed in `backend.actions.pluginSources`
- **THEN** all thirty-six actions are listed by the actions service with their input and output schemas

#### Scenario: Read actions are marked read-only

- **WHEN** the registered actions are listed
- **THEN** the seventeen reading actions carry read-only attributes, and the writing actions do not

#### Scenario: Delete is marked destructive

- **WHEN** the registered actions are listed
- **THEN** `delete-work-item` and `delete-comment` carry destructive attributes and every other action does not
