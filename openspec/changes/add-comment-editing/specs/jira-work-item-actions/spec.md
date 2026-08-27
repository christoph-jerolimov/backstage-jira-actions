# jira-work-item-actions Delta

## ADDED Requirements

### Requirement: Update comment action

The system SHALL provide an `update-comment` action that replaces the body of an existing comment on a Jira issue. The input SHALL accept `issueKey` (required), `commentId` (required), `body` (required — a string, or an ADF document when `bodyFormat` is `adf`), `bodyFormat` (optional: `markdown` (default), `adf`, or `text`, per the rich text conversion requirement), and `host` (optional). On success, the output SHALL include the issue `key`, the `commentId`, and the issue `url`.

#### Scenario: Update a comment

- **WHEN** the action is invoked with an issue key, a comment id, and a new body
- **THEN** the comment's body is replaced with the new content in the requested format

#### Scenario: Comment does not exist

- **WHEN** the action is invoked with an unknown comment id
- **THEN** the action fails with a NotFound-style error that includes Jira's error details

### Requirement: Delete comment action

The system SHALL provide a `delete-comment` action that permanently deletes a comment from a Jira issue. The input SHALL accept `issueKey` (required), `commentId` (required), and `host` (optional). The action SHALL be marked destructive in its registry attributes and SHALL be guarded by the delete permission. On success, the output SHALL include the issue `key` and the deleted `commentId`.

#### Scenario: Delete a comment

- **WHEN** the action is invoked with an issue key and a comment id
- **THEN** the comment is permanently deleted and the output reports the issue key and comment id

#### Scenario: Comment does not exist

- **WHEN** the action is invoked with an unknown comment id
- **THEN** the action fails with a NotFound-style error that includes Jira's error details

## MODIFIED Requirements

### Requirement: Jira actions are registered in the Actions Registry

The system SHALL register the Jira work item actions in the Backstage Actions Registry under the `jira-actions` plugin, so that they are discoverable and invokable through the actions service, and exposed via the MCP actions backend when the `jira-actions` plugin is listed in `backend.actions.pluginSources`. The registered actions SHALL be `create-work-item`, `update-work-item`, `rename-work-item`, `set-work-item-parent`, `delete-work-item`, `get-work-item`, `search-work-items`, `search-users`, `add-comment`, `get-comments`, `update-comment`, `delete-comment`, `add-label`, `remove-label`, `add-remote-link`, `get-remote-links`, `link-work-items`, `list-link-types`, `list-transitions`, `transition-work-item`, `list-projects`, `list-issue-types`, `list-fields`, `list-versions`, `list-components`, `create-version`, `get-worklogs`, `add-worklog`, `add-watcher`, `remove-watcher`, `list-boards`, `list-sprints`, and `move-to-sprint`. Each action SHALL declare a title, a description, and typed input and output schemas so that callers (including AI agents) can discover how to use it without external documentation. The purely reading actions (`get-work-item`, `search-work-items`, `search-users`, `get-comments`, `get-remote-links`, `list-link-types`, `list-transitions`, `list-projects`, `list-issue-types`, `list-fields`, `list-versions`, `list-components`, `get-worklogs`, `list-boards`, `list-sprints`) SHALL be marked read-only in their registry attributes. `delete-work-item` and `delete-comment` SHALL be the only actions marked destructive.

#### Scenario: Actions are discoverable

- **WHEN** the backend starts with the Jira actions plugin installed and `jira-actions` listed in `backend.actions.pluginSources`
- **THEN** all thirty-three actions are listed by the actions service with their input and output schemas

#### Scenario: Read actions are marked read-only

- **WHEN** the registered actions are listed
- **THEN** the fifteen reading actions carry read-only attributes, and the writing actions do not

#### Scenario: Delete is marked destructive

- **WHEN** the registered actions are listed
- **THEN** `delete-work-item` and `delete-comment` carry destructive attributes and every other action does not

### Requirement: Actions are guarded by the permission framework

The system SHALL register three permissions with the Backstage permission framework — a read permission covering the read-only actions, a write permission covering the modifying actions, and a delete permission covering the destructive delete actions (`delete-work-item` and `delete-comment`) — so that operators can control access with permission policies. Every action SHALL authorize the invoking caller's credentials against its permission before any Jira API call; a denied decision SHALL fail the action with a NotAllowed-style error and no Jira call SHALL be made. Under Backstage's default allow-all policy, all actions SHALL continue to work unchanged.

#### Scenario: Permissions are registered

- **WHEN** the backend starts with the Jira actions plugin installed
- **THEN** the plugin's read, write, and delete permissions are registered with the permission framework

#### Scenario: A denied write is rejected before Jira is called

- **WHEN** the active permission policy denies the write permission for the caller and a write action is invoked
- **THEN** the action fails with a NotAllowed-style error and no Jira API call is made

#### Scenario: Default policy allows all actions

- **WHEN** no custom permission policy is installed
- **THEN** all actions behave as before, with no authorization failures
