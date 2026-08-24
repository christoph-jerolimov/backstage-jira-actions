## Purpose

Provides Backstage Actions Registry actions to create and modify Jira work items (stories, bugs, tasks, and other issue types), so any registry consumer — including the MCP actions endpoint — can manage Jira tickets through Backstage.

## ADDED Requirements

### Requirement: Jira actions are registered in the Actions Registry

The system SHALL register the Jira work item actions in the Backstage Actions Registry under the `jira` plugin, so that they are discoverable and invokable through the actions service, and exposed via the MCP actions backend when the `jira` plugin is listed in `backend.actions.pluginSources`. Each action SHALL declare a title, a description, and typed input and output schemas so that callers (including AI agents) can discover how to use it without external documentation.

#### Scenario: Actions are discoverable

- **WHEN** the backend starts with the Jira actions plugin installed and `jira` listed in `backend.actions.pluginSources`
- **THEN** the actions `create-work-item` and `update-work-item` are listed by the actions service with their input and output schemas

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
