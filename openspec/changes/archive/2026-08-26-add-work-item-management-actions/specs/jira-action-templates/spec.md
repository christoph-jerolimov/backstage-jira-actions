## MODIFIED Requirements

### Requirement: One test template per Jira action

The system SHALL provide one software template per registered Jira action — `create-work-item`, `update-work-item`, `rename-work-item`, `set-work-item-parent`, `get-work-item`, `search-work-items`, `add-comment`, `get-comments`, `add-label`, `remove-label`, `transition-work-item`, `list-projects`, and `list-issue-types` — registered in the software catalog so they appear in the template list. Each template SHALL declare parameters mirroring the corresponding action's input schema (matching required/optional fields, with descriptions), SHALL invoke that registry action directly as its single working step (step `action` set to the action's id, e.g. `jira-actions:create-work-item`, with the parameters as the step input), and SHALL surface the action result in the template output: the step output as text, and a link to the issue for actions whose output contains an issue `url`. For actions that accept an `entityRef` input, the template SHALL offer it as a catalog entity picker field alongside the `projectKey` parameter.

For the list-returning read actions the template output SHALL contain two text blocks, the second always being the pretty-printed JSON dump of the step output. The first block SHALL be a Markdown table for `list-projects` (columns Key — linked to the project `url` — Name, and Description), `list-issue-types` (columns Name, Description, and Sub-task), and `search-work-items` (columns Key — linked to the issue `url` — Summary, Status, Type, and Assignee, covering all attributes of each result item); for `get-comments` the first block SHALL render each comment as a section with its author, timestamp, and body.

#### Scenario: Templates are registered in the catalog

- **WHEN** the backend starts with the example template location configured
- **THEN** the catalog contains thirteen Jira test templates, one per Jira action

#### Scenario: Template steps invoke the registry action directly

- **WHEN** the `list-issue-types` test template runs
- **THEN** its single step uses `jira-actions:list-issue-types` as the step action with the form parameters as the step input, without any intermediary action

#### Scenario: Template parameters mirror the action input

- **WHEN** a user opens the `create-work-item` test template
- **THEN** the form asks for the action's inputs (issueType and summary as required; projectKey, entityRef, description, descriptionFormat, labels, assignee, parentKey, host as optional, with either projectKey or entityRef expected)

#### Scenario: Project-scoped templates offer an entity picker

- **WHEN** a user opens the `create-work-item`, `search-work-items`, or `list-issue-types` test template
- **THEN** the form offers an entity picker for the `entityRef` input as an alternative to entering a project key

#### Scenario: List results are rendered as a Markdown list plus a JSON dump

- **WHEN** a user runs the `list-projects`, `list-issue-types`, or `search-work-items` test template
- **THEN** the run output shows a Markdown table with the specified columns (one row per result item, keys linked to their URLs where specified) as the first text block, followed by the pretty-printed JSON dump of the step output as the second

#### Scenario: Comments are rendered as sections plus a JSON dump

- **WHEN** a user runs the `get-comments` test template
- **THEN** the run output shows each comment with its author, timestamp, and body as the first text block, followed by the pretty-printed JSON dump as the second

#### Scenario: Running a template invokes its action and shows the result

- **WHEN** a user runs the `create-work-item` test template with valid parameters
- **THEN** the template invokes `jira-actions:create-work-item` with those parameters, and the run output shows the created issue's key and a link to its URL
