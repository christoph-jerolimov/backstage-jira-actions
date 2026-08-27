# jira-work-item-actions Delta

## ADDED Requirements

### Requirement: Get attachments action

The system SHALL provide a `get-attachments` action that reads the attachments of a Jira issue. The input SHALL accept `issueKey` (required) and `host` (optional). On success, the output SHALL include the issue `key`, its `url`, and an `attachments` array — each entry with the attachment `id`, `filename`, `downloadUrl`, and, when Jira provides them, `size` (bytes), `mimeType`, `author` (display name), and `created`. The action reads metadata only; downloading content and uploading attachments are out of scope.

#### Scenario: Read the attachments of an issue

- **WHEN** the action is invoked with the key of an issue that has attachments
- **THEN** the output lists each attachment with its filename, download URL, and available metadata

#### Scenario: Issue without attachments

- **WHEN** the action is invoked for an issue with no attachments
- **THEN** the output contains an empty `attachments` array

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: List backlog work items action

The system SHALL provide a `list-backlog-work-items` action that lists the backlog issues of an agile board via Jira's Agile API. The input SHALL accept `boardId` (required), `maxResults` (default 50, capped at 100), `pageToken` (optional cursor from a previous invocation), and `host` (optional). On success, the output SHALL include an `items` array — each item with `key`, `summary`, `status`, `issueType`, `url`, and `assignee` when present, as in `list-sprint-work-items` — and a `nextPageToken` cursor when more items remain.

#### Scenario: List the backlog of a board

- **WHEN** the action is invoked with an existing board's id
- **THEN** the output lists the board's backlog issues with key, summary, status, type, and URL

#### Scenario: Fetch the next page of backlog items

- **WHEN** a listing returns a `nextPageToken` and the action is invoked again with it as `pageToken`
- **THEN** the next page of items is returned, and `nextPageToken` is absent once no further items remain

#### Scenario: Board does not exist

- **WHEN** the action is invoked with an unknown board id
- **THEN** the action fails with a NotFound-style error naming the board id

## MODIFIED Requirements

### Requirement: Add remote link action

The system SHALL provide an `add-remote-link` action that attaches a web link to a Jira issue. The input SHALL accept `issueKey` (required), `url` (required: the link target), `title` (required: the link text shown in Jira), `globalId` (optional: a caller-chosen stable identifier — Jira upserts remote links by global id, so re-running with the same `globalId` updates the existing link instead of creating a duplicate), and `host` (optional). On success, the output SHALL include the issue `key`, the created or updated `remoteLinkId`, and the issue's browseable `url`.

#### Scenario: Attach a link to an issue

- **WHEN** the action is invoked with an issue key, a URL, and a title
- **THEN** a remote link with that URL and title is attached to the issue and the output reports the remote link id

#### Scenario: Re-running with a globalId updates instead of duplicating

- **WHEN** the action is invoked twice with the same `globalId` and a changed title
- **THEN** the request carries the global id both times and Jira updates the existing link rather than creating a second one

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: Get remote links action

The system SHALL provide a `get-remote-links` action that reads the web links attached to a Jira issue. The input SHALL accept `issueKey` (required) and `host` (optional). On success, the output SHALL include the issue `key`, its `url`, and a `remoteLinks` array — each entry with the remote link `id`, `title`, `url`, and `globalId` when the link carries one.

#### Scenario: Read the remote links of an issue

- **WHEN** the action is invoked with the key of an issue that has remote links
- **THEN** the output lists each remote link with its id, title, URL, and global id when present

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: Jira actions are registered in the Actions Registry

The system SHALL register the Jira work item actions in the Backstage Actions Registry under the `jira-actions` plugin, so that they are discoverable and invokable through the actions service, and exposed via the MCP actions backend when the `jira-actions` plugin is listed in `backend.actions.pluginSources`. The registered actions SHALL be `create-work-item`, `create-work-items`, `update-work-item`, `rename-work-item`, `set-work-item-parent`, `delete-work-item`, `get-work-item`, `get-attachments`, `search-work-items`, `search-users`, `add-comment`, `get-comments`, `update-comment`, `delete-comment`, `add-label`, `remove-label`, `add-remote-link`, `get-remote-links`, `link-work-items`, `list-link-types`, `list-transitions`, `transition-work-item`, `list-projects`, `list-issue-types`, `list-fields`, `list-versions`, `list-components`, `create-version`, `get-worklogs`, `add-worklog`, `add-watcher`, `remove-watcher`, `list-boards`, `list-sprints`, `list-sprint-work-items`, `list-backlog-work-items`, `get-sprint-insights`, `create-sprint`, `update-sprint`, `start-sprint`, `complete-sprint`, `move-to-sprint`, and `move-to-backlog`. Each action SHALL declare a title, a description, typed input and output schemas, and at least one usage example (a titled, realistic input — with an output where illustrative) so that callers (including AI agents) can discover how to use it without external documentation. The purely reading actions (`get-work-item`, `get-attachments`, `search-work-items`, `search-users`, `get-comments`, `get-remote-links`, `list-link-types`, `list-transitions`, `list-projects`, `list-issue-types`, `list-fields`, `list-versions`, `list-components`, `get-worklogs`, `list-boards`, `list-sprints`, `list-sprint-work-items`, `list-backlog-work-items`, `get-sprint-insights`) SHALL be marked read-only in their registry attributes. `delete-work-item` and `delete-comment` SHALL be the only actions marked destructive.

#### Scenario: Actions are discoverable

- **WHEN** the backend starts with the Jira actions plugin installed and `jira-actions` listed in `backend.actions.pluginSources`
- **THEN** all forty-three actions are listed by the actions service with their input and output schemas

#### Scenario: Read actions are marked read-only

- **WHEN** the registered actions are listed
- **THEN** the nineteen reading actions carry read-only attributes, and the writing actions do not

#### Scenario: Delete is marked destructive

- **WHEN** the registered actions are listed
- **THEN** `delete-work-item` and `delete-comment` carry destructive attributes and every other action does not

#### Scenario: Every action carries an example

- **WHEN** the registered actions are listed
- **THEN** every action declares at least one example with a title and an input that satisfies the action's input schema
