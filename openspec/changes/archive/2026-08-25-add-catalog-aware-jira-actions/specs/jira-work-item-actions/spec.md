## ADDED Requirements

### Requirement: Actions resolve Jira projects from catalog entities

The project-scoped actions (`create-work-item`, `search-work-items`, `list-issue-types`) SHALL accept an `entityRef` input (e.g. `component:default/my-service`) as an alternative to `projectKey`. When `entityRef` is given, the action SHALL look up the entity in the software catalog using the invoking caller's credentials and use the entity's `jira/project-key` annotation as the project key. When the entity also carries a `jira/host` annotation and the action's `host` input is not given, that annotation SHALL select the Jira connection.

Error behavior:

- An `entityRef` that does not resolve to a catalog entity (unknown, or not visible to the caller) SHALL fail with a NotFound-style error naming the entity ref.
- An entity without a `jira/project-key` annotation SHALL fail with an error naming the missing annotation.
- Providing both `projectKey` and `entityRef` SHALL be rejected as invalid input before any catalog or Jira call.

#### Scenario: Create a work item for a catalog entity

- **WHEN** `create-work-item` is invoked with `entityRef: component:default/my-service` and the entity carries the annotation `jira/project-key: PROJ`
- **THEN** the issue is created in project `PROJ`

#### Scenario: Entity annotation selects the Jira host

- **WHEN** an action is invoked with an `entityRef` whose entity carries `jira/host: jira.example.com`, no `host` input is given, and multiple Jira connections are configured
- **THEN** the Jira API calls target the connection with host `jira.example.com`

#### Scenario: Explicit host input wins over the annotation

- **WHEN** an action is invoked with both a `host` input and an `entityRef` whose entity carries a different `jira/host` annotation
- **THEN** the connection matching the `host` input is used

#### Scenario: Entity is not found

- **WHEN** an action is invoked with an `entityRef` that the catalog does not resolve for the caller
- **THEN** the action fails with a NotFound-style error naming the entity ref, and no Jira call is made

#### Scenario: Entity lacks the annotation

- **WHEN** an action is invoked with an `entityRef` whose entity has no `jira/project-key` annotation
- **THEN** the action fails with an error naming the `jira/project-key` annotation, and no Jira call is made

#### Scenario: Both projectKey and entityRef given

- **WHEN** an action is invoked with both `projectKey` and `entityRef`
- **THEN** the action fails with an input validation error before any catalog or Jira call

## MODIFIED Requirements

### Requirement: Create work item action

The system SHALL provide a `create-work-item` action that creates a Jira issue. The input SHALL accept:

- `projectKey` (optional): the Jira project key, e.g. `PROJ`.
- `entityRef` (optional): a catalog entity ref whose `jira/project-key` annotation identifies the project.
- `issueType` (required): the issue type name, e.g. `Story`, `Bug`, `Task`.
- `summary` (required): the issue summary line.
- `description` (optional): plain-text description of the issue.
- `labels` (optional): list of labels to set.
- `assignee` (optional): the Jira account ID (Cloud) or username (Data Center) to assign.
- `parentKey` (optional): key of a parent issue (for sub-tasks or issues under an epic).
- `host` (optional): the Jira host to target when multiple connections are configured.

Exactly one of `projectKey` and `entityRef` MUST be provided; an invocation with neither or both SHALL be rejected as invalid input. On success, the output SHALL include the created issue's `key` (e.g. `PROJ-123`), its `id`, and a browseable `url` to the issue.

#### Scenario: Create a bug with minimal input

- **WHEN** the action is invoked with `projectKey: PROJ`, `issueType: Bug`, and `summary: "Login fails on Safari"`
- **THEN** a Jira issue of type Bug is created in project PROJ with that summary, and the output contains the new issue key, id, and URL

#### Scenario: Create a story with optional fields

- **WHEN** the action is invoked with a `description`, `labels`, and an `assignee` in addition to the required fields
- **THEN** the created issue carries the description, labels, and assignee as provided

#### Scenario: Neither projectKey nor entityRef

- **WHEN** the action is invoked without `projectKey` and without `entityRef`
- **THEN** the action fails with an input validation error before any Jira API call is made

#### Scenario: Jira rejects the creation

- **WHEN** Jira responds with an error (e.g. unknown project key, unknown issue type, or insufficient permission)
- **THEN** the action fails with an error message that includes Jira's error details, and no output is produced

### Requirement: Search work items action

The system SHALL provide a `search-work-items` action that finds Jira issues either by a raw `jql` input or by simplified filter inputs: `projectKey` or `entityRef` (a catalog entity ref whose `jira/project-key` annotation identifies the project), `text` (free-text match on summary/description), `status`, `issueType`, `assignee`, and `labels`. When `jql` is given it SHALL be used as-is and the simplified filters SHALL be rejected as conflicting input; when it is absent, at least one filter MUST be provided and the action SHALL build the equivalent JQL. The input SHALL accept `maxResults` (default 25, capped at 100) and `host`. On success, the output SHALL include an `items` array — each item with `key`, `summary`, `status`, `issueType`, `url`, and `assignee` when present — ordered by most recently updated when the JQL is built from filters.

#### Scenario: Search by simplified filters

- **WHEN** the action is invoked with `projectKey: PROJ` and `status: "In Progress"`
- **THEN** the issues matching that project and status are returned as items with key, summary, status, issue type, and URL

#### Scenario: Search by entity ref

- **WHEN** the action is invoked with `entityRef: component:default/my-service` whose entity carries `jira/project-key: PROJ`
- **THEN** the search is restricted to project `PROJ`

#### Scenario: Search by raw JQL

- **WHEN** the action is invoked with a `jql` input and no simplified filters
- **THEN** that JQL is sent to Jira unchanged and the matching issues are returned

#### Scenario: No search criteria

- **WHEN** the action is invoked with neither `jql` nor any simplified filter
- **THEN** the action fails with an input validation error before any Jira API call is made

#### Scenario: Invalid JQL

- **WHEN** Jira rejects the query as invalid
- **THEN** the action fails with an error that includes Jira's error details

### Requirement: List issue types action

The system SHALL provide a `list-issue-types` action that lists the issue types available in a given project, identified either by `projectKey` or by `entityRef` (a catalog entity ref whose `jira/project-key` annotation identifies the project) — exactly one of the two MUST be provided. The input SHALL also accept `host` (optional). On success, the output SHALL include an `issueTypes` array, each entry with the issue type `id`, `name`, and a `subtask` flag; entry `description` SHALL be included when Jira provides one.

#### Scenario: List issue types of a project

- **WHEN** the action is invoked with `projectKey: PROJ`
- **THEN** the output lists that project's issue types with id, name, and subtask flag

#### Scenario: List issue types via entity ref

- **WHEN** the action is invoked with `entityRef: component:default/my-service` whose entity carries `jira/project-key: PROJ`
- **THEN** the output lists the issue types of project `PROJ`

#### Scenario: Project does not exist

- **WHEN** the action is invoked with an unknown project key
- **THEN** the action fails with a NotFound-style error naming the project key
