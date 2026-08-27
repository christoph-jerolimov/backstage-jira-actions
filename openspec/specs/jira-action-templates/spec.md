# jira-action-templates Specification

## Purpose

Lets every Jira registry action be exercised end-to-end from the Backstage software templates UI: one test template per action collects the action's inputs as parameters, invokes the registry action directly as its template step, and surfaces its output.

## Requirements

### Requirement: One test template per Jira action

The system SHALL provide one software template per registered Jira action — forty-three templates covering `create-work-item`, `create-work-items`, `update-work-item`, `rename-work-item`, `set-work-item-parent`, `delete-work-item`, `get-work-item`, `get-attachments`, `search-work-items`, `search-users`, `add-comment`, `get-comments`, `update-comment`, `delete-comment`, `add-label`, `remove-label`, `add-remote-link`, `get-remote-links`, `link-work-items`, `list-link-types`, `list-transitions`, `transition-work-item`, `list-projects`, `list-issue-types`, `list-fields`, `list-versions`, `list-components`, `create-version`, `get-worklogs`, `add-worklog`, `add-watcher`, `remove-watcher`, `list-boards`, `list-sprints`, `list-sprint-work-items`, `list-backlog-work-items`, `get-sprint-insights`, `create-sprint`, `update-sprint`, `start-sprint`, `complete-sprint`, `move-to-sprint`, and `move-to-backlog` — registered in the software catalog so they appear in the template list. Each template SHALL declare parameters mirroring the corresponding action's input schema (matching required/optional fields, with descriptions), SHALL invoke that registry action directly as its single working step (step `action` set to the action's id, e.g. `jira-actions:create-work-item`, with the parameters as the step input), and SHALL surface the action result in the template output: the step output as text, and a link to the issue for actions whose output contains an issue `url`. For actions that accept an `entityRef` input, the template SHALL offer it as a catalog entity picker field alongside the `projectKey` parameter.

For the list-returning read actions the template output SHALL contain two text blocks, the second always being the pretty-printed JSON dump of the step output. The first block SHALL be a Markdown table for `list-projects` (columns Key — linked to the project `url` — Name, and Description), `list-issue-types` (columns Name, Description, and Sub-task), `search-work-items`, `list-sprint-work-items`, and `list-backlog-work-items` (columns Key — linked to the issue `url` — Summary, Status, Type, and Assignee), `search-users` (columns Name, ID, and Email), `list-transitions` (columns Name and To status), `list-link-types` (columns Name, Outward, and Inward), `list-fields` (columns ID, Name, Custom, and Type), `list-versions` (columns Name, Released, Release date, and Description), `list-components` (columns Name, Description, and Lead), `get-remote-links` (columns Title — linked to the remote link `url` — and URL), `get-attachments` (columns Filename — linked to the `downloadUrl` — Size, Type, and Author), `list-boards` (columns ID, Name, and Type), and `list-sprints` (columns Name, State, Start, and End); for `get-comments` the first block SHALL render each comment as a section with its author, timestamp, and body, and for `get-worklogs` each worklog as a section with its author, time spent, start timestamp, and comment. The `get-sprint-insights` template SHALL render the sprint summary (name, state, goal, completed of total) followed by Name/Count tables for the status, type, and assignee breakdowns, before the JSON dump.

#### Scenario: Templates are registered in the catalog

- **WHEN** the backend starts with the example template location configured
- **THEN** the catalog contains forty-three Jira test templates, one per Jira action

#### Scenario: Template steps invoke the registry action directly

- **WHEN** the `list-issue-types` test template runs
- **THEN** its single step uses `jira-actions:list-issue-types` as the step action with the form parameters as the step input, without any intermediary action

#### Scenario: Template parameters mirror the action input

- **WHEN** a user opens the `create-work-item` test template
- **THEN** the form asks for the action's inputs (issueType and summary as required; projectKey, entityRef, description, descriptionFormat, labels, assignee, parentKey, fixVersions, affectsVersions, components, customFields, host as optional, with either projectKey or entityRef expected)

#### Scenario: Project-scoped templates offer an entity picker

- **WHEN** a user opens the `create-work-item`, `create-work-items`, `search-work-items`, `list-issue-types`, `list-versions`, `list-components`, or `create-version` test template
- **THEN** the form offers an entity picker for the `entityRef` input as an alternative to entering a project key

#### Scenario: List results are rendered as a Markdown list plus a JSON dump

- **WHEN** a user runs any of the list-returning test templates (`list-projects`, `list-issue-types`, `search-work-items`, `list-sprint-work-items`, `list-backlog-work-items`, `search-users`, `list-transitions`, `list-link-types`, `list-fields`, `list-versions`, `list-components`, `get-remote-links`, `get-attachments`, `list-boards`, or `list-sprints`)
- **THEN** the run output shows a Markdown table with the specified columns (one row per result item, keys linked to their URLs where specified) as the first text block, followed by the pretty-printed JSON dump of the step output as the second

#### Scenario: Comments are rendered as sections plus a JSON dump

- **WHEN** a user runs the `get-comments` or `get-worklogs` test template
- **THEN** the run output shows each entry as a section with its author and details as the first text block, followed by the pretty-printed JSON dump as the second

#### Scenario: Running a template invokes its action and shows the result

- **WHEN** a user runs the `create-work-item` test template with valid parameters
- **THEN** the template invokes `jira-actions:create-work-item` with those parameters, and the run output shows the created issue's key and a link to its URL
