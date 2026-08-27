# jira-work-item-actions Delta

## ADDED Requirements

### Requirement: List versions action

The system SHALL provide a `list-versions` action that lists the versions of a Jira project, identified by `projectKey` or `entityRef` (exactly one, per the catalog-entity-resolution requirement). The input SHALL also accept `host` (optional). On success, the output SHALL include a `versions` array — each entry with the version `id`, `name`, `released` and `archived` flags, and, when Jira provides them, `releaseDate`, `startDate`, and `description`.

#### Scenario: List the versions of a project

- **WHEN** the action is invoked with `projectKey: PROJ`
- **THEN** the output lists that project's versions with id, name, and released/archived flags

#### Scenario: Project does not exist

- **WHEN** the action is invoked with an unknown project key
- **THEN** the action fails with a NotFound-style error naming the project key

### Requirement: List components action

The system SHALL provide a `list-components` action that lists the components of a Jira project, identified by `projectKey` or `entityRef` (exactly one). The input SHALL also accept `host` (optional). On success, the output SHALL include a `components` array — each entry with the component `id`, `name`, and, when Jira provides them, `description` and `lead` (the lead's display name).

#### Scenario: List the components of a project

- **WHEN** the action is invoked with `projectKey: PROJ`
- **THEN** the output lists that project's components with id and name

#### Scenario: Project does not exist

- **WHEN** the action is invoked with an unknown project key
- **THEN** the action fails with a NotFound-style error naming the project key

### Requirement: Create version action

The system SHALL provide a `create-version` action that creates a version in a Jira project, identified by `projectKey` or `entityRef` (exactly one). The input SHALL accept `name` (required), `description` (optional), `startDate` and `releaseDate` (optional, `YYYY-MM-DD`), and `host` (optional). The action SHALL resolve the project's internal id before creating the version. On success, the output SHALL include the created version's `id` and `name`. Creating a version whose name already exists SHALL fail with Jira's error details.

#### Scenario: Create a version

- **WHEN** the action is invoked with `projectKey: PROJ` and `name: "1.2.0"`
- **THEN** a version named 1.2.0 is created in project PROJ and the output reports its id and name

#### Scenario: Version already exists

- **WHEN** the action is invoked with a name that already exists in the project
- **THEN** the action fails with an error that includes Jira's error details

## MODIFIED Requirements

### Requirement: Jira actions are registered in the Actions Registry

The system SHALL register the Jira work item actions in the Backstage Actions Registry under the `jira-actions` plugin, so that they are discoverable and invokable through the actions service, and exposed via the MCP actions backend when the `jira-actions` plugin is listed in `backend.actions.pluginSources`. The registered actions SHALL be `create-work-item`, `update-work-item`, `rename-work-item`, `set-work-item-parent`, `delete-work-item`, `get-work-item`, `search-work-items`, `search-users`, `add-comment`, `get-comments`, `add-label`, `remove-label`, `link-work-items`, `list-link-types`, `list-transitions`, `transition-work-item`, `list-projects`, `list-issue-types`, `list-fields`, `list-versions`, `list-components`, `create-version`, `get-worklogs`, `add-worklog`, `add-watcher`, `remove-watcher`, `list-boards`, `list-sprints`, and `move-to-sprint`. Each action SHALL declare a title, a description, and typed input and output schemas so that callers (including AI agents) can discover how to use it without external documentation. The purely reading actions (`get-work-item`, `search-work-items`, `search-users`, `get-comments`, `list-link-types`, `list-transitions`, `list-projects`, `list-issue-types`, `list-fields`, `list-versions`, `list-components`, `get-worklogs`, `list-boards`, `list-sprints`) SHALL be marked read-only in their registry attributes. `delete-work-item` SHALL be the only action marked destructive.

#### Scenario: Actions are discoverable

- **WHEN** the backend starts with the Jira actions plugin installed and `jira-actions` listed in `backend.actions.pluginSources`
- **THEN** all twenty-nine actions are listed by the actions service with their input and output schemas

#### Scenario: Read actions are marked read-only

- **WHEN** the registered actions are listed
- **THEN** the fourteen reading actions carry read-only attributes, and the writing actions do not

#### Scenario: Delete is marked destructive

- **WHEN** the registered actions are listed
- **THEN** `delete-work-item` carries destructive attributes and every other action does not

### Requirement: Create work item action

The system SHALL provide a `create-work-item` action that creates a Jira issue. The input SHALL accept:

- `projectKey` (optional): the Jira project key, e.g. `PROJ`.
- `entityRef` (optional): a catalog entity ref whose `jira/project-key` annotation identifies the project.
- `issueType` (required): the issue type name, e.g. `Story`, `Bug`, `Task`.
- `summary` (required): the issue summary line.
- `description` (optional): the issue description — a string, or an ADF document when `descriptionFormat` is `adf`.
- `descriptionFormat` (optional): how to interpret `description` — `markdown` (default), `adf`, or `text`, per the rich text conversion requirement.
- `labels` (optional): list of labels to set.
- `assignee` (optional): the Jira account ID (Cloud) or username (Data Center) to assign.
- `parentKey` (optional): key of a parent issue (for sub-tasks or issues under an epic).
- `fixVersions` (optional): list of version names to set as fix versions.
- `affectsVersions` (optional): list of version names to set as affected versions.
- `components` (optional): list of component names to set.
- `customFields` (optional): an object mapping Jira field ids (e.g. `customfield_10020`, as discoverable via `list-fields`) to values, passed to Jira verbatim as additional issue fields.
- `host` (optional): the Jira host to target when multiple connections are configured.

Version and component names are passed to Jira by name; unknown names fail with Jira's error details. Exactly one of `projectKey` and `entityRef` MUST be provided; an invocation with neither or both SHALL be rejected as invalid input. On success, the output SHALL include the created issue's `key` (e.g. `PROJ-123`), its `id`, and a browseable `url` to the issue.

#### Scenario: Create a bug with minimal input

- **WHEN** the action is invoked with `projectKey: PROJ`, `issueType: Bug`, and `summary: "Login fails on Safari"`
- **THEN** a Jira issue of type Bug is created in project PROJ with that summary, and the output contains the new issue key, id, and URL

#### Scenario: Create a story with optional fields

- **WHEN** the action is invoked with a `description`, `labels`, and an `assignee` in addition to the required fields
- **THEN** the created issue carries the description, labels, and assignee as provided

#### Scenario: Create with an ADF description

- **WHEN** the action is invoked on a Jira Cloud connection with `descriptionFormat: adf` and an ADF document as the description
- **THEN** the issue is created with exactly that ADF description

#### Scenario: Create with custom fields

- **WHEN** the action is invoked with `customFields: { customfield_10020: 5 }`
- **THEN** the create request sent to Jira carries `customfield_10020: 5` as an issue field

#### Scenario: Create with versions and components

- **WHEN** the action is invoked with `fixVersions: ["1.2.0"]`, `affectsVersions: ["1.1.0"]`, and `components: ["backend"]`
- **THEN** the create request carries the corresponding name-referenced fixVersions, versions, and components fields

#### Scenario: Neither projectKey nor entityRef

- **WHEN** the action is invoked without `projectKey` and without `entityRef`
- **THEN** the action fails with an input validation error before any Jira API call is made

#### Scenario: Jira rejects the creation

- **WHEN** Jira responds with an error (e.g. unknown project key, unknown issue type, or insufficient permission)
- **THEN** the action fails with an error message that includes Jira's error details, and no output is produced

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
- `fixVersions` (optional): full replacement list of fix version names.
- `affectsVersions` (optional): full replacement list of affected version names.
- `components` (optional): full replacement list of component names.
- `customFields` (optional): an object mapping Jira field ids to new values, passed to Jira verbatim as issue fields; counts as an updatable field.
- `host` (optional): the Jira host to target when multiple connections are configured.

The version and component inputs count as updatable fields. At least one updatable field MUST be provided; an invocation naming only `issueKey` (with or without `descriptionFormat`) SHALL be rejected as invalid input. Combining `labels` with `addLabels` or `removeLabels` SHALL be rejected as invalid input, since a full replacement and incremental edits conflict. On success, the output SHALL include the issue `key` and a browseable `url`.

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

#### Scenario: Update custom fields

- **WHEN** the action is invoked with only `issueKey` and `customFields`
- **THEN** the update is accepted and the request sent to Jira carries the custom field values verbatim

#### Scenario: Update versions and components

- **WHEN** the action is invoked with only `issueKey` and `fixVersions`
- **THEN** the update is accepted and the request carries the name-referenced fixVersions field

#### Scenario: No fields to update

- **WHEN** the action is invoked with only `issueKey` and no updatable fields
- **THEN** the action fails with an input validation error before any Jira API call is made

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an issue key that Jira does not know
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: Get work item action

The system SHALL provide a `get-work-item` action that reads a single Jira issue by its key. The input SHALL accept `issueKey` (required), `descriptionFormat` (optional: `markdown`, `adf`, or `text`, defaulting to `markdown`), `customFields` (optional: a list of Jira field ids to read in addition to the standard fields), and `host` (optional, as for the other actions). On success, the output SHALL include the issue `key`, `summary`, `status` (status name), `issueType` (type name), `url`, and — when present on the issue — `description` rendered in the requested format per the rich text conversion requirement (a string for `markdown` and `text`, the raw ADF document for `adf` on Jira Cloud), `assignee` (account ID on Cloud, username on Data Center), `labels`, `parentKey`, the `created` and `updated` timestamps, `fixVersions`, `affectsVersions`, and `components` (arrays of names), the issue's `links` (each with the resolved link `type` name, the relation `direction` description as it reads from this issue, e.g. `blocks` or `is blocked by`, and the linked issue's `key`), and `customFields` (an object with the requested field ids and their raw values) when custom fields were requested.

#### Scenario: Read an existing issue

- **WHEN** the action is invoked with the key of an existing issue
- **THEN** the output contains the issue's key, summary, status name, issue type name, and browseable URL, with optional fields included when the issue has them

#### Scenario: Cloud description is returned as Markdown by default

- **WHEN** an issue on a Jira Cloud connection has a rich-text (ADF) description and no `descriptionFormat` is given
- **THEN** the output `description` is the Markdown rendering of that document, not an ADF object

#### Scenario: Cloud description is returned as plain text

- **WHEN** the action is invoked with `descriptionFormat: text` for a Cloud issue with a rich-text (ADF) description
- **THEN** the output `description` is the plain-text rendering with formatting dropped, not an ADF object

#### Scenario: Cloud description is returned as raw ADF

- **WHEN** the action is invoked with `descriptionFormat: adf` for a Cloud issue with a rich-text (ADF) description
- **THEN** the output `description` is the raw ADF document

#### Scenario: Versions and components are included

- **WHEN** the action is invoked for an issue that has fix versions, affected versions, or components
- **THEN** the output includes their names as `fixVersions`, `affectsVersions`, and `components` arrays

#### Scenario: Issue links are included

- **WHEN** the action is invoked for an issue that has issue links
- **THEN** the output `links` lists each linked issue with the link type, the direction as it reads from this issue, and the linked issue's key

#### Scenario: Read selected custom fields

- **WHEN** the action is invoked with `customFields: [customfield_10020]`
- **THEN** the output `customFields` object contains that field id with the issue's raw value for it

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: Actions resolve Jira projects from catalog entities

The project-scoped actions (`create-work-item`, `search-work-items`, `list-issue-types`, `list-versions`, `list-components`, `create-version`) SHALL accept an `entityRef` input (e.g. `component:default/my-service`) as an alternative to `projectKey`. When `entityRef` is given, the action SHALL look up the entity in the software catalog using the invoking caller's credentials and use the entity's `jira/project-key` annotation as the project key. When the entity also carries a `jira/host` annotation and the action's `host` input is not given, that annotation SHALL select the Jira connection.

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

#### Scenario: List versions via entity ref

- **WHEN** `list-versions` is invoked with `entityRef: component:default/my-service` whose entity carries `jira/project-key: PROJ`
- **THEN** the output lists the versions of project `PROJ`
