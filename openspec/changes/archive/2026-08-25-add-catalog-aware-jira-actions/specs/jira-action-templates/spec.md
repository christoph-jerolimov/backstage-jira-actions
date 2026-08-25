## MODIFIED Requirements

### Requirement: One test template per Jira action

The system SHALL provide one software template per registered Jira action — `create-work-item`, `update-work-item`, `get-work-item`, `search-work-items`, `add-comment`, `transition-work-item`, `list-projects`, and `list-issue-types` — registered in the software catalog so they appear in the template list. Each template SHALL declare parameters mirroring the corresponding action's input schema (matching required/optional fields, with descriptions), SHALL invoke that action through the `jira:action:invoke` bridge as its single working step, and SHALL surface the action result in the template output: the result as text, and a link to the issue for actions whose output contains an issue `url`. For actions that accept an `entityRef` input, the template SHALL offer it as a catalog entity picker field alongside the `projectKey` parameter.

#### Scenario: Templates are registered in the catalog

- **WHEN** the backend starts with the example template location configured
- **THEN** the catalog contains eight Jira test templates, one per Jira action

#### Scenario: Template parameters mirror the action input

- **WHEN** a user opens the `create-work-item` test template
- **THEN** the form asks for the action's inputs (issueType and summary as required; projectKey, entityRef, description, labels, assignee, parentKey, host as optional, with either projectKey or entityRef expected)

#### Scenario: Project-scoped templates offer an entity picker

- **WHEN** a user opens the `create-work-item`, `search-work-items`, or `list-issue-types` test template
- **THEN** the form offers an entity picker for the `entityRef` input as an alternative to entering a project key

#### Scenario: Running a template invokes its action and shows the result

- **WHEN** a user runs the `create-work-item` test template with valid parameters
- **THEN** the template invokes `jira-actions:create-work-item` with those parameters, and the run output shows the created issue's key and a link to its URL
