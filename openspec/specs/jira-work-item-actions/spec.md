# jira-work-item-actions Specification

## Purpose

Provides Backstage Actions Registry actions to create and modify Jira work items (stories, bugs, tasks, and other issue types), so any registry consumer — including the MCP actions endpoint — can manage Jira tickets through Backstage.

## Requirements

### Requirement: Jira actions are registered in the Actions Registry

The system SHALL register the Jira work item actions in the Backstage Actions Registry under the `jira-actions` plugin, so that they are discoverable and invokable through the actions service, and exposed via the MCP actions backend when the `jira-actions` plugin is listed in `backend.actions.pluginSources`. The registered actions SHALL be `create-work-item`, `update-work-item`, `get-work-item`, `search-work-items`, `add-comment`, `transition-work-item`, `list-projects`, and `list-issue-types`. Each action SHALL declare a title, a description, and typed input and output schemas so that callers (including AI agents) can discover how to use it without external documentation. The purely reading actions (`get-work-item`, `search-work-items`, `list-projects`, `list-issue-types`) SHALL be marked read-only in their registry attributes.

#### Scenario: Actions are discoverable

- **WHEN** the backend starts with the Jira actions plugin installed and `jira-actions` listed in `backend.actions.pluginSources`
- **THEN** all eight actions are listed by the actions service with their input and output schemas

#### Scenario: Read actions are marked read-only

- **WHEN** the registered actions are listed
- **THEN** `get-work-item`, `search-work-items`, `list-projects`, and `list-issue-types` carry read-only attributes, and the writing actions do not

### Requirement: Create work item action

The system SHALL provide a `create-work-item` action that creates a Jira issue. The input SHALL accept:

- `projectKey` (required): the Jira project key, e.g. `PROJ`.
- `issueType` (required): the issue type name, e.g. `Story`, `Bug`, `Task`.
- `summary` (required): the issue summary line.
- `description` (optional): plain-text description of the issue.
- `labels` (optional): list of labels to set.
- `assignee` (optional): the Jira account ID (Cloud) or username (Data Center) to assign.
- `parentKey` (optional): key of a parent issue (for sub-tasks or issues under an epic).
- `host` (optional): the Jira host to target when multiple connections are configured.

On success, the output SHALL include the created issue's `key` (e.g. `PROJ-123`), its `id`, and a browseable `url` to the issue.

#### Scenario: Create a bug with minimal input

- **WHEN** the action is invoked with `projectKey: PROJ`, `issueType: Bug`, and `summary: "Login fails on Safari"`
- **THEN** a Jira issue of type Bug is created in project PROJ with that summary, and the output contains the new issue key, id, and URL

#### Scenario: Create a story with optional fields

- **WHEN** the action is invoked with a `description`, `labels`, and an `assignee` in addition to the required fields
- **THEN** the created issue carries the description, labels, and assignee as provided

#### Scenario: Jira rejects the creation

- **WHEN** Jira responds with an error (e.g. unknown project key, unknown issue type, or insufficient permission)
- **THEN** the action fails with an error message that includes Jira's error details, and no output is produced

### Requirement: Update work item action

The system SHALL provide an `update-work-item` action that modifies an existing Jira issue identified by its issue key. The input SHALL accept:

- `issueKey` (required): the key of the issue to update, e.g. `PROJ-123`.
- `summary` (optional): new summary.
- `description` (optional): new plain-text description.
- `labels` (optional): full replacement list of labels.
- `assignee` (optional): new assignee (account ID or username).
- `issueType` (optional): new issue type name.
- `host` (optional): the Jira host to target when multiple connections are configured.

At least one updatable field MUST be provided; an invocation naming only `issueKey` SHALL be rejected as invalid input. On success, the output SHALL include the issue `key` and a browseable `url`.

#### Scenario: Update the summary of an issue

- **WHEN** the action is invoked with `issueKey: PROJ-123` and a new `summary`
- **THEN** the Jira issue PROJ-123 has its summary replaced and the output contains the issue key and URL

#### Scenario: No fields to update

- **WHEN** the action is invoked with only `issueKey` and no updatable fields
- **THEN** the action fails with an input validation error before any Jira API call is made

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an issue key that Jira does not know
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: Actions use the configured Jira connection

Actions SHALL resolve their Jira connection through the Jira connections capability. When no `host` input is given, the default (first configured) Jira connection SHALL be used; when a `host` input is given, the connection for that host SHALL be used. If no usable connection exists, the action SHALL fail with an error directing the operator to the `connections` configuration.

#### Scenario: No Jira connection configured

- **WHEN** an action is invoked while no `connections` entry with `type: jira` exists
- **THEN** the action fails with an error explaining that a Jira connection must be configured in the `connections` section

#### Scenario: Targeting a specific host

- **WHEN** two Jira connections are configured and an action is invoked with the `host` input set to the second connection's host
- **THEN** the Jira API calls are made against that host using that connection's credentials

### Requirement: Get work item action

The system SHALL provide a `get-work-item` action that reads a single Jira issue by its key. The input SHALL accept `issueKey` (required) and `host` (optional, as for the other actions). On success, the output SHALL include the issue `key`, `summary`, `status` (status name), `issueType` (type name), `url`, and — when present on the issue — `description` as plain text (converted from ADF on Jira Cloud), `assignee` (account ID on Cloud, username on Data Center), `labels`, `parentKey`, and the `created` and `updated` timestamps.

#### Scenario: Read an existing issue

- **WHEN** the action is invoked with the key of an existing issue
- **THEN** the output contains the issue's key, summary, status name, issue type name, and browseable URL, with optional fields included when the issue has them

#### Scenario: Cloud description is returned as plain text

- **WHEN** an issue on a Jira Cloud connection has a rich-text (ADF) description
- **THEN** the output `description` is the plain-text rendering of that document, not an ADF object

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: Search work items action

The system SHALL provide a `search-work-items` action that finds Jira issues either by a raw `jql` input or by simplified filter inputs: `projectKey`, `text` (free-text match on summary/description), `status`, `issueType`, `assignee`, and `labels`. When `jql` is given it SHALL be used as-is and the simplified filters SHALL be rejected as conflicting input; when it is absent, at least one filter MUST be provided and the action SHALL build the equivalent JQL. The input SHALL accept `maxResults` (default 25, capped at 100) and `host`. On success, the output SHALL include an `items` array — each item with `key`, `summary`, `status`, `issueType`, `url`, and `assignee` when present — ordered by most recently updated when the JQL is built from filters.

#### Scenario: Search by simplified filters

- **WHEN** the action is invoked with `projectKey: PROJ` and `status: "In Progress"`
- **THEN** the issues matching that project and status are returned as items with key, summary, status, issue type, and URL

#### Scenario: Search by raw JQL

- **WHEN** the action is invoked with a `jql` input and no simplified filters
- **THEN** that JQL is sent to Jira unchanged and the matching issues are returned

#### Scenario: No search criteria

- **WHEN** the action is invoked with neither `jql` nor any simplified filter
- **THEN** the action fails with an input validation error before any Jira API call is made

#### Scenario: Invalid JQL

- **WHEN** Jira rejects the query as invalid
- **THEN** the action fails with an error that includes Jira's error details

### Requirement: Add comment action

The system SHALL provide an `add-comment` action that adds a comment to an existing Jira issue. The input SHALL accept `issueKey` (required), `body` (required, plain text), and `host` (optional). The comment body SHALL be sent as an ADF document on Jira Cloud and as plain text on Jira Data Center. On success, the output SHALL include the issue `key`, the created comment's `commentId`, and the issue `url`.

#### Scenario: Comment on an existing issue

- **WHEN** the action is invoked with an issue key and a body
- **THEN** a comment with that text is added to the issue and the output contains the issue key, the new comment id, and the issue URL

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: Transition work item action

The system SHALL provide a `transition-work-item` action that moves a Jira issue to a target status. The input SHALL accept `issueKey` (required), `status` (required, the target status name), and `host` (optional). The action SHALL resolve the workflow transition whose target status matches the requested name case-insensitively (also accepting a matching transition name) from the issue's currently available transitions, and execute it. If the issue is already in the target status, the action SHALL succeed without performing a transition. On success, the output SHALL include the issue `key`, the resulting `status` name, and the issue `url`.

#### Scenario: Transition to an available status

- **WHEN** the action is invoked with `status: "In Progress"` and the issue's workflow offers a transition to that status
- **THEN** that transition is executed and the output reports the issue key and the new status

#### Scenario: Already in the target status

- **WHEN** the action is invoked with a status the issue already has
- **THEN** the action succeeds without executing a transition and reports the current status

#### Scenario: Status not reachable

- **WHEN** no available transition leads to the requested status
- **THEN** the action fails with an error that names the requested status and lists the statuses currently reachable from the issue

### Requirement: List projects action

The system SHALL provide a `list-projects` action that lists the Jira projects visible to the configured credentials. The input SHALL accept `maxResults` (default 50, capped at 100) and `host` (optional). On success, the output SHALL include a `projects` array, each entry with the project `key`, `name`, and `id`.

#### Scenario: List visible projects

- **WHEN** the action is invoked
- **THEN** the output lists the visible projects with key, name, and id

### Requirement: List issue types action

The system SHALL provide a `list-issue-types` action that lists the issue types available in a given project. The input SHALL accept `projectKey` (required) and `host` (optional). On success, the output SHALL include an `issueTypes` array, each entry with the issue type `id`, `name`, and a `subtask` flag; entry `description` SHALL be included when Jira provides one.

#### Scenario: List issue types of a project

- **WHEN** the action is invoked with `projectKey: PROJ`
- **THEN** the output lists that project's issue types with id, name, and subtask flag

#### Scenario: Project does not exist

- **WHEN** the action is invoked with an unknown project key
- **THEN** the action fails with a NotFound-style error naming the project key
