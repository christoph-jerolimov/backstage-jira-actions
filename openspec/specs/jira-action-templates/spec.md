# jira-action-templates Specification

## Purpose

Lets every Jira registry action be exercised end-to-end from the Backstage software templates UI: one test template per action collects the action's inputs as parameters, invokes the registry action directly as its template step, and surfaces its output.

## Requirements

### Requirement: Scaffolder bridge action invokes Jira registry actions

The system SHALL provide a scaffolder action `jira:action:invoke` that invokes an Actions Registry action by its id and passes through the given input. The action SHALL accept `actionId` (required, e.g. `jira-actions:create-work-item`) and `input` (optional object, defaulting to empty). Only actions of the `jira-actions` plugin SHALL be invokable — an `actionId` outside the `jira-actions:` namespace SHALL be rejected as invalid input before any invocation. The registry action's output SHALL be exposed as the scaffolder step output `result`, and registry action failures SHALL fail the template run with the underlying error message.

#### Scenario: Invoke a Jira action from a template step

- **WHEN** a template step runs `jira:action:invoke` with `actionId: jira-actions:get-work-item` and a valid `input`
- **THEN** that registry action is invoked with the given input and the step's `result` output contains the action's output

#### Scenario: Non-Jira action id is rejected

- **WHEN** a template step runs `jira:action:invoke` with an `actionId` outside the `jira-actions:` namespace (e.g. `catalog:something`)
- **THEN** the step fails with an input validation error and no action is invoked

#### Scenario: Registry action failure fails the step

- **WHEN** the invoked registry action fails (e.g. unknown issue key)
- **THEN** the template run fails and the error message includes the underlying action error

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
