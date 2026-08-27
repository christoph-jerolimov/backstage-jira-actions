# jira-work-item-actions Delta

## ADDED Requirements

### Requirement: Create work items action

The system SHALL provide a `create-work-items` action that creates multiple Jira issues in one invocation via Jira's bulk-create endpoint. The input SHALL accept:

- `projectKey` or `entityRef` (exactly one, per the catalog-entity-resolution requirement).
- `epic` (optional): a work item to create first and use as the parent of every item — with `summary` (required), `issueType` (optional, default `Epic`), and the same optional `description`, `descriptionFormat`, `labels`, `assignee`, and `customFields` fields as `create-work-item`.
- `parentKey` (optional): an existing parent for every item; MUST NOT be combined with `epic`.
- `items` (required): one to fifty entries, each with `issueType` and `summary` (required) and the same optional fields as the epic.
- `host` (optional).

Rich text and `me` assignee resolution SHALL behave as on `create-work-item`. On success, the output SHALL include `items` — the created issues' `key`, `id`, and `url` in input order — and `parent` (`key`, `url`) when an epic was created. If Jira reports errors for some entries of the bulk call, the action SHALL fail with an error naming the failed entries and Jira's details, and listing any issues that were created before the failure.

#### Scenario: Create an epic with children

- **WHEN** the action is invoked with an `epic` and three `items`
- **THEN** the epic is created first, the three items are bulk-created with the epic as their parent, and the output lists the epic and the three created issues

#### Scenario: Create siblings under an existing parent

- **WHEN** the action is invoked with `parentKey: PROJ-1` and two `items`
- **THEN** both items are bulk-created with PROJ-1 as their parent and no epic is created

#### Scenario: Epic conflicts with parentKey

- **WHEN** the action is invoked with both `epic` and `parentKey`
- **THEN** the action fails with an input validation error before any Jira call

#### Scenario: Partial bulk failure

- **WHEN** Jira rejects some entries of the bulk call
- **THEN** the action fails with an error that names the failed entries with Jira's details and lists any issues that were created

## MODIFIED Requirements

### Requirement: Jira actions are registered in the Actions Registry

The system SHALL register the Jira work item actions in the Backstage Actions Registry under the `jira-actions` plugin, so that they are discoverable and invokable through the actions service, and exposed via the MCP actions backend when the `jira-actions` plugin is listed in `backend.actions.pluginSources`. The registered actions SHALL be `create-work-item`, `create-work-items`, `update-work-item`, `rename-work-item`, `set-work-item-parent`, `delete-work-item`, `get-work-item`, `search-work-items`, `search-users`, `add-comment`, `get-comments`, `update-comment`, `delete-comment`, `add-label`, `remove-label`, `add-remote-link`, `get-remote-links`, `link-work-items`, `list-link-types`, `list-transitions`, `transition-work-item`, `list-projects`, `list-issue-types`, `list-fields`, `list-versions`, `list-components`, `create-version`, `get-worklogs`, `add-worklog`, `add-watcher`, `remove-watcher`, `list-boards`, `list-sprints`, `list-sprint-work-items`, `get-sprint-insights`, `create-sprint`, `update-sprint`, `start-sprint`, `complete-sprint`, `move-to-sprint`, and `move-to-backlog`. Each action SHALL declare a title, a description, and typed input and output schemas so that callers (including AI agents) can discover how to use it without external documentation. The purely reading actions (`get-work-item`, `search-work-items`, `search-users`, `get-comments`, `get-remote-links`, `list-link-types`, `list-transitions`, `list-projects`, `list-issue-types`, `list-fields`, `list-versions`, `list-components`, `get-worklogs`, `list-boards`, `list-sprints`, `list-sprint-work-items`, `get-sprint-insights`) SHALL be marked read-only in their registry attributes. `delete-work-item` and `delete-comment` SHALL be the only actions marked destructive.

#### Scenario: Actions are discoverable

- **WHEN** the backend starts with the Jira actions plugin installed and `jira-actions` listed in `backend.actions.pluginSources`
- **THEN** all forty-one actions are listed by the actions service with their input and output schemas

#### Scenario: Read actions are marked read-only

- **WHEN** the registered actions are listed
- **THEN** the seventeen reading actions carry read-only attributes, and the writing actions do not

#### Scenario: Delete is marked destructive

- **WHEN** the registered actions are listed
- **THEN** `delete-work-item` and `delete-comment` carry destructive attributes and every other action does not

### Requirement: Actions resolve Jira projects from catalog entities

The project-scoped actions (`create-work-item`, `create-work-items`, `search-work-items`, `list-issue-types`, `list-versions`, `list-components`, `create-version`) SHALL accept an `entityRef` input (e.g. `component:default/my-service`) as an alternative to `projectKey`. When `entityRef` is given, the action SHALL look up the entity in the software catalog using the invoking caller's credentials and use the entity's `jira/project-key` annotation as the project key. When the entity also carries a `jira/host` annotation and the action's `host` input is not given, that annotation SHALL select the Jira connection.

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
