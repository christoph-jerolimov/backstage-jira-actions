# jira-work-item-actions Delta

## ADDED Requirements

### Requirement: Create sprint action

The system SHALL provide a `create-sprint` action that creates a sprint on an agile board. The input SHALL accept `boardId` (required), `name` (required), `startDate` and `endDate` (optional ISO timestamps), `goal` (optional), and `host` (optional). On success, the output SHALL include the created sprint's `id`, `name`, and `state` (a new sprint starts in the `future` state).

#### Scenario: Create a sprint

- **WHEN** the action is invoked with a board id and a name
- **THEN** a future sprint with that name is created on the board and the output reports its id, name, and state

#### Scenario: Board does not exist

- **WHEN** the action is invoked with an unknown board id
- **THEN** the action fails with an error that includes Jira's error details

### Requirement: Update sprint action

The system SHALL provide an `update-sprint` action that edits a sprint's `name`, `goal`, `startDate`, and/or `endDate` — at least one MUST be provided; an invocation with none SHALL be rejected as invalid input. The input SHALL also accept `sprintId` (required) and `host` (optional). The update SHALL be partial, leaving unnamed fields untouched. On success, the output SHALL include the sprint's `id`, `name`, `state`, and, when present, `startDate`, `endDate`, and `goal`.

#### Scenario: Change the sprint goal

- **WHEN** the action is invoked with a sprint id and a new `goal`
- **THEN** only the goal is changed and the output reflects the updated sprint

#### Scenario: No fields to update

- **WHEN** the action is invoked with only `sprintId`
- **THEN** the action fails with an input validation error before any Jira API call is made

#### Scenario: Sprint does not exist

- **WHEN** the action is invoked with an unknown sprint id
- **THEN** the action fails with a NotFound-style error naming the sprint id

### Requirement: Start sprint action

The system SHALL provide a `start-sprint` action that activates a sprint. The input SHALL accept `sprintId` (required), `startDate` and `endDate` (optional ISO timestamps, passed along with the activation since Jira requires dates to start a scrum sprint when none are set), and `host` (optional). On success, the output SHALL include the sprint's `id`, `name`, and `state`. Jira's rejections (e.g. a sprint that is not startable, or missing dates) SHALL fail the action with Jira's error details.

#### Scenario: Start a sprint

- **WHEN** the action is invoked with a future sprint's id and dates
- **THEN** the sprint becomes active and the output reports state `active`

#### Scenario: Jira rejects the start

- **WHEN** Jira rejects the activation (e.g. another sprint is already active, or dates are missing)
- **THEN** the action fails with an error that includes Jira's error details

### Requirement: Complete sprint action

The system SHALL provide a `complete-sprint` action that closes an active sprint. The input SHALL accept `sprintId` (required) and `host` (optional). On success, the output SHALL include the sprint's `id`, `name`, and `state` (`closed`). Incomplete issues are handled by Jira's own behavior (they move to the backlog).

#### Scenario: Complete a sprint

- **WHEN** the action is invoked with an active sprint's id
- **THEN** the sprint is closed and the output reports state `closed`

#### Scenario: Sprint does not exist

- **WHEN** the action is invoked with an unknown sprint id
- **THEN** the action fails with a NotFound-style error naming the sprint id

## MODIFIED Requirements

### Requirement: Jira actions are registered in the Actions Registry

The system SHALL register the Jira work item actions in the Backstage Actions Registry under the `jira-actions` plugin, so that they are discoverable and invokable through the actions service, and exposed via the MCP actions backend when the `jira-actions` plugin is listed in `backend.actions.pluginSources`. The registered actions SHALL be `create-work-item`, `update-work-item`, `rename-work-item`, `set-work-item-parent`, `delete-work-item`, `get-work-item`, `search-work-items`, `search-users`, `add-comment`, `get-comments`, `update-comment`, `delete-comment`, `add-label`, `remove-label`, `add-remote-link`, `get-remote-links`, `link-work-items`, `list-link-types`, `list-transitions`, `transition-work-item`, `list-projects`, `list-issue-types`, `list-fields`, `list-versions`, `list-components`, `create-version`, `get-worklogs`, `add-worklog`, `add-watcher`, `remove-watcher`, `list-boards`, `list-sprints`, `list-sprint-work-items`, `get-sprint-insights`, `create-sprint`, `update-sprint`, `start-sprint`, `complete-sprint`, `move-to-sprint`, and `move-to-backlog`. Each action SHALL declare a title, a description, and typed input and output schemas so that callers (including AI agents) can discover how to use it without external documentation. The purely reading actions (`get-work-item`, `search-work-items`, `search-users`, `get-comments`, `get-remote-links`, `list-link-types`, `list-transitions`, `list-projects`, `list-issue-types`, `list-fields`, `list-versions`, `list-components`, `get-worklogs`, `list-boards`, `list-sprints`, `list-sprint-work-items`, `get-sprint-insights`) SHALL be marked read-only in their registry attributes. `delete-work-item` and `delete-comment` SHALL be the only actions marked destructive.

#### Scenario: Actions are discoverable

- **WHEN** the backend starts with the Jira actions plugin installed and `jira-actions` listed in `backend.actions.pluginSources`
- **THEN** all forty actions are listed by the actions service with their input and output schemas

#### Scenario: Read actions are marked read-only

- **WHEN** the registered actions are listed
- **THEN** the seventeen reading actions carry read-only attributes, and the writing actions do not

#### Scenario: Delete is marked destructive

- **WHEN** the registered actions are listed
- **THEN** `delete-work-item` and `delete-comment` carry destructive attributes and every other action does not
