## ADDED Requirements

### Requirement: Get comments action

The system SHALL provide a `get-comments` action that reads the comments of a Jira issue. The input SHALL accept `issueKey` (required), `bodyFormat` (optional: `markdown`, `adf`, or `text`, defaulting to `markdown`, applied to each comment body per the rich text conversion requirement), `maxResults` (default 50, capped at 100), and `host` (optional). On success, the output SHALL include the issue `key`, its `url`, and a `comments` array — each entry with the comment `id`, `author` (display name when available), `body` in the requested format, and the `created` and `updated` timestamps.

#### Scenario: Read the comments of an issue

- **WHEN** the action is invoked with the key of an issue that has comments
- **THEN** the output lists the comments with id, author, body rendered as Markdown by default, and timestamps

#### Scenario: Comment bodies honor the format selector

- **WHEN** the action is invoked with `bodyFormat: adf` on a Jira Cloud connection
- **THEN** each comment body is the raw ADF document

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: Add label action

The system SHALL provide an `add-label` action that adds a single label to a Jira issue using Jira's incremental label update (never replacing the full list). The input SHALL accept `issueKey` (required), `label` (required), and `host` (optional). On success, the output SHALL include the issue `key`, its `url`, and the issue's resulting `labels`. Adding a label the issue already has SHALL succeed (labels are a set).

#### Scenario: Add a label

- **WHEN** the action is invoked with `issueKey: PROJ-1` and `label: needs-review`
- **THEN** the label is added without affecting other labels, and the output reports the issue's resulting labels

#### Scenario: Adding an existing label is idempotent

- **WHEN** the action is invoked with a label the issue already carries
- **THEN** the action succeeds and the resulting labels are unchanged

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: Remove label action

The system SHALL provide a `remove-label` action that removes a single label from a Jira issue using Jira's incremental label update. The input SHALL accept `issueKey` (required), `label` (required), and `host` (optional). On success, the output SHALL include the issue `key`, its `url`, and the issue's resulting `labels`. Removing a label the issue does not have SHALL succeed without changes.

#### Scenario: Remove a label

- **WHEN** the action is invoked with a label the issue carries
- **THEN** the label is removed without affecting other labels, and the output reports the issue's resulting labels

#### Scenario: Removing an absent label is idempotent

- **WHEN** the action is invoked with a label the issue does not carry
- **THEN** the action succeeds and the resulting labels are unchanged

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: Rename work item action

The system SHALL provide a `rename-work-item` action that changes only the summary of a Jira issue. The input SHALL accept `issueKey` (required), `summary` (required), and `host` (optional). On success, the output SHALL include the issue `key`, the new `summary`, and its `url`.

#### Scenario: Rename an issue

- **WHEN** the action is invoked with `issueKey: PROJ-1` and a new `summary`
- **THEN** the issue's summary is replaced and the output reports the key, new summary, and URL

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: Set work item parent action

The system SHALL provide a `set-work-item-parent` action that changes only the parent of a Jira issue. The input SHALL accept `issueKey` (required), `parentKey` (required), and `host` (optional). On success, the output SHALL include the issue `key`, the `parentKey`, and the issue's `url`.

#### Scenario: Set the parent of an issue

- **WHEN** the action is invoked with `issueKey: PROJ-2` and `parentKey: PROJ-1`
- **THEN** the issue's parent is set to PROJ-1 and the output reports the key, parent key, and URL

#### Scenario: Jira rejects the parent

- **WHEN** Jira rejects the parent change (e.g. invalid hierarchy or unknown parent)
- **THEN** the action fails with an error that includes Jira's error details

## MODIFIED Requirements

### Requirement: Jira actions are registered in the Actions Registry

The system SHALL register the Jira work item actions in the Backstage Actions Registry under the `jira-actions` plugin, so that they are discoverable and invokable through the actions service, and exposed via the MCP actions backend when the `jira-actions` plugin is listed in `backend.actions.pluginSources`. The registered actions SHALL be `create-work-item`, `update-work-item`, `rename-work-item`, `set-work-item-parent`, `get-work-item`, `search-work-items`, `add-comment`, `get-comments`, `add-label`, `remove-label`, `transition-work-item`, `list-projects`, and `list-issue-types`. Each action SHALL declare a title, a description, and typed input and output schemas so that callers (including AI agents) can discover how to use it without external documentation. The purely reading actions (`get-work-item`, `search-work-items`, `get-comments`, `list-projects`, `list-issue-types`) SHALL be marked read-only in their registry attributes.

#### Scenario: Actions are discoverable

- **WHEN** the backend starts with the Jira actions plugin installed and `jira-actions` listed in `backend.actions.pluginSources`
- **THEN** all thirteen actions are listed by the actions service with their input and output schemas

#### Scenario: Read actions are marked read-only

- **WHEN** the registered actions are listed
- **THEN** `get-work-item`, `search-work-items`, `get-comments`, `list-projects`, and `list-issue-types` carry read-only attributes, and the writing actions do not

### Requirement: Update work item action

The system SHALL provide an `update-work-item` action that modifies an existing Jira issue identified by its issue key. The input SHALL accept:

- `issueKey` (required): the key of the issue to update, e.g. `PROJ-123`.
- `summary` (optional): new summary.
- `description` (optional): the new description — a string, or an ADF document when `descriptionFormat` is `adf`.
- `descriptionFormat` (optional): how to interpret `description` — `markdown` (default), `adf`, or `text`, per the rich text conversion requirement.
- `labels` (optional): full replacement list of labels.
- `addLabels` (optional): labels to add incrementally, preserving the rest.
- `removeLabels` (optional): labels to remove incrementally, preserving the rest.
- `assignee` (optional): new assignee (account ID or username).
- `issueType` (optional): new issue type name.
- `host` (optional): the Jira host to target when multiple connections are configured.

At least one updatable field MUST be provided; an invocation naming only `issueKey` (with or without `descriptionFormat`) SHALL be rejected as invalid input. Combining `labels` with `addLabels` or `removeLabels` SHALL be rejected as invalid input, since a full replacement and incremental edits conflict. On success, the output SHALL include the issue `key` and a browseable `url`.

#### Scenario: Update the summary of an issue

- **WHEN** the action is invoked with `issueKey: PROJ-123` and a new `summary`
- **THEN** the Jira issue PROJ-123 has its summary replaced and the output contains the issue key and URL

#### Scenario: Update with a literal text description

- **WHEN** the action is invoked with a `description` and `descriptionFormat: text` on a Jira Cloud connection
- **THEN** the description is stored as literal paragraphs without Markdown interpretation

#### Scenario: Incremental label edits

- **WHEN** the action is invoked with `addLabels` and/or `removeLabels`
- **THEN** those labels are added and removed incrementally without affecting the issue's other labels

#### Scenario: Full replacement conflicts with incremental edits

- **WHEN** the action is invoked with `labels` together with `addLabels` or `removeLabels`
- **THEN** the action fails with an input validation error before any Jira API call is made

#### Scenario: No fields to update

- **WHEN** the action is invoked with only `issueKey` and no updatable fields
- **THEN** the action fails with an input validation error before any Jira API call is made

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an issue key that Jira does not know
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: List projects action

The system SHALL provide a `list-projects` action that lists the Jira projects visible to the configured credentials. The input SHALL accept `name` (optional: a case-insensitive substring filter matched against project names and keys), `maxResults` (default 50, capped at 100), and `host` (optional). On success, the output SHALL include a `projects` array, each entry with the project `key`, `name`, `id`, a browseable `url`, and `description` when Jira provides one.

#### Scenario: List visible projects

- **WHEN** the action is invoked
- **THEN** the output lists the visible projects with key, name, id, url, and description when present

#### Scenario: Filter projects by name

- **WHEN** the action is invoked with `name: pay`
- **THEN** only projects whose name or key matches the filter (case-insensitively) are returned
