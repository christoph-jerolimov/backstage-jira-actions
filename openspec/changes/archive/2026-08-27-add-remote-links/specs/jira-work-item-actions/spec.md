# jira-work-item-actions Delta

## ADDED Requirements

### Requirement: Add remote link action

The system SHALL provide an `add-remote-link` action that attaches a web link to a Jira issue. The input SHALL accept `issueKey` (required), `url` (required: the link target), `title` (required: the link text shown in Jira), and `host` (optional). On success, the output SHALL include the issue `key`, the created `remoteLinkId`, and the issue's browseable `url`.

#### Scenario: Attach a link to an issue

- **WHEN** the action is invoked with an issue key, a URL, and a title
- **THEN** a remote link with that URL and title is attached to the issue and the output reports the remote link id

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: Get remote links action

The system SHALL provide a `get-remote-links` action that reads the web links attached to a Jira issue. The input SHALL accept `issueKey` (required) and `host` (optional). On success, the output SHALL include the issue `key`, its `url`, and a `remoteLinks` array — each entry with the remote link `id`, `title`, and `url`.

#### Scenario: Read the remote links of an issue

- **WHEN** the action is invoked with the key of an issue that has remote links
- **THEN** the output lists each remote link with its id, title, and URL

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key

## MODIFIED Requirements

### Requirement: Jira actions are registered in the Actions Registry

The system SHALL register the Jira work item actions in the Backstage Actions Registry under the `jira-actions` plugin, so that they are discoverable and invokable through the actions service, and exposed via the MCP actions backend when the `jira-actions` plugin is listed in `backend.actions.pluginSources`. The registered actions SHALL be `create-work-item`, `update-work-item`, `rename-work-item`, `set-work-item-parent`, `delete-work-item`, `get-work-item`, `search-work-items`, `search-users`, `add-comment`, `get-comments`, `add-label`, `remove-label`, `add-remote-link`, `get-remote-links`, `link-work-items`, `list-link-types`, `list-transitions`, `transition-work-item`, `list-projects`, `list-issue-types`, `list-fields`, `list-versions`, `list-components`, `create-version`, `get-worklogs`, `add-worklog`, `add-watcher`, `remove-watcher`, `list-boards`, `list-sprints`, and `move-to-sprint`. Each action SHALL declare a title, a description, and typed input and output schemas so that callers (including AI agents) can discover how to use it without external documentation. The purely reading actions (`get-work-item`, `search-work-items`, `search-users`, `get-comments`, `get-remote-links`, `list-link-types`, `list-transitions`, `list-projects`, `list-issue-types`, `list-fields`, `list-versions`, `list-components`, `get-worklogs`, `list-boards`, `list-sprints`) SHALL be marked read-only in their registry attributes. `delete-work-item` SHALL be the only action marked destructive.

#### Scenario: Actions are discoverable

- **WHEN** the backend starts with the Jira actions plugin installed and `jira-actions` listed in `backend.actions.pluginSources`
- **THEN** all thirty-one actions are listed by the actions service with their input and output schemas

#### Scenario: Read actions are marked read-only

- **WHEN** the registered actions are listed
- **THEN** the fifteen reading actions carry read-only attributes, and the writing actions do not

#### Scenario: Delete is marked destructive

- **WHEN** the registered actions are listed
- **THEN** `delete-work-item` carries destructive attributes and every other action does not
