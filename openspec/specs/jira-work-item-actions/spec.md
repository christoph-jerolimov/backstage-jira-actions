# jira-work-item-actions Specification

## Purpose

Provides Backstage Actions Registry actions to create and modify Jira work items (stories, bugs, tasks, and other issue types), so any registry consumer — including the MCP actions endpoint — can manage Jira tickets through Backstage.

## Requirements

### Requirement: Jira actions are registered in the Actions Registry

The system SHALL register the Jira work item actions in the Backstage Actions Registry under the `jira-actions` plugin, so that they are discoverable and invokable through the actions service, and exposed via the MCP actions backend when the `jira-actions` plugin is listed in `backend.actions.pluginSources`. The registered actions SHALL be `create-work-item`, `update-work-item`, `rename-work-item`, `set-work-item-parent`, `get-work-item`, `search-work-items`, `add-comment`, `get-comments`, `add-label`, `remove-label`, `transition-work-item`, `list-projects`, and `list-issue-types`. Each action SHALL declare a title, a description, and typed input and output schemas so that callers (including AI agents) can discover how to use it without external documentation. The purely reading actions (`get-work-item`, `search-work-items`, `get-comments`, `list-projects`, `list-issue-types`) SHALL be marked read-only in their registry attributes.

#### Scenario: Actions are discoverable

- **WHEN** the backend starts with the Jira actions plugin installed and `jira-actions` listed in `backend.actions.pluginSources`
- **THEN** all thirteen actions are listed by the actions service with their input and output schemas

#### Scenario: Read actions are marked read-only

- **WHEN** the registered actions are listed
- **THEN** `get-work-item`, `search-work-items`, `get-comments`, `list-projects`, and `list-issue-types` carry read-only attributes, and the writing actions do not

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
- `host` (optional): the Jira host to target when multiple connections are configured.

Exactly one of `projectKey` and `entityRef` MUST be provided; an invocation with neither or both SHALL be rejected as invalid input. On success, the output SHALL include the created issue's `key` (e.g. `PROJ-123`), its `id`, and a browseable `url` to the issue.

#### Scenario: Create a bug with minimal input

- **WHEN** the action is invoked with `projectKey: PROJ`, `issueType: Bug`, and `summary: "Login fails on Safari"`
- **THEN** a Jira issue of type Bug is created in project PROJ with that summary, and the output contains the new issue key, id, and URL

#### Scenario: Create a story with optional fields

- **WHEN** the action is invoked with a `description`, `labels`, and an `assignee` in addition to the required fields
- **THEN** the created issue carries the description, labels, and assignee as provided

#### Scenario: Create with an ADF description

- **WHEN** the action is invoked on a Jira Cloud connection with `descriptionFormat: adf` and an ADF document as the description
- **THEN** the issue is created with exactly that ADF description

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

### Requirement: Actions use the configured Jira connection

Actions SHALL resolve their Jira connection through the Jira connections capability. When no `host` input is given, the default (first configured) Jira connection SHALL be used; when a `host` input is given, the connection for that host SHALL be used. If no usable connection exists, the action SHALL fail with an error directing the operator to the `connections` configuration.

#### Scenario: No Jira connection configured

- **WHEN** an action is invoked while no `connections` entry with `type: jira` exists
- **THEN** the action fails with an error explaining that a Jira connection must be configured in the `connections` section

#### Scenario: Targeting a specific host

- **WHEN** two Jira connections are configured and an action is invoked with the `host` input set to the second connection's host
- **THEN** the Jira API calls are made against that host using that connection's credentials

### Requirement: Get work item action

The system SHALL provide a `get-work-item` action that reads a single Jira issue by its key. The input SHALL accept `issueKey` (required), `descriptionFormat` (optional: `markdown`, `adf`, or `text`, defaulting to `markdown`), and `host` (optional, as for the other actions). On success, the output SHALL include the issue `key`, `summary`, `status` (status name), `issueType` (type name), `url`, and — when present on the issue — `description` rendered in the requested format per the rich text conversion requirement (a string for `markdown` and `text`, the raw ADF document for `adf` on Jira Cloud), `assignee` (account ID on Cloud, username on Data Center), `labels`, `parentKey`, and the `created` and `updated` timestamps.

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

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key

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

### Requirement: Add comment action

The system SHALL provide an `add-comment` action that adds a comment to an existing Jira issue. The input SHALL accept `issueKey` (required), `body` (required — a string, or an ADF document when `bodyFormat` is `adf`), `bodyFormat` (optional: `markdown` (default), `adf`, or `text`, per the rich text conversion requirement), and `host` (optional). On success, the output SHALL include the issue `key`, the created comment's `commentId`, and the issue `url`.

#### Scenario: Comment on an existing issue

- **WHEN** the action is invoked with an issue key and a body
- **THEN** a comment with that text is added to the issue and the output contains the issue key, the new comment id, and the issue URL

#### Scenario: Comment with an ADF body

- **WHEN** the action is invoked on a Jira Cloud connection with `bodyFormat: adf` and an ADF document as the body
- **THEN** exactly that ADF document is posted as the comment body

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

The system SHALL provide a `list-projects` action that lists the Jira projects visible to the configured credentials. The input SHALL accept `name` (optional: a case-insensitive substring filter matched against project names and keys), `maxResults` (default 50, capped at 100), and `host` (optional). On success, the output SHALL include a `projects` array, each entry with the project `key`, `name`, `id`, a browseable `url`, and `description` when Jira provides one.

#### Scenario: List visible projects

- **WHEN** the action is invoked
- **THEN** the output lists the visible projects with key, name, id, url, and description when present

#### Scenario: Filter projects by name

- **WHEN** the action is invoked with `name: pay`
- **THEN** only projects whose name or key matches the filter (case-insensitively) are returned

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

### Requirement: Markdown rich text conversion

Rich-text inputs (descriptions and comment bodies) SHALL be interpreted according to an explicit format selector with three values — `markdown` (the default), `text`, and `adf` — and rich-text fields read back from Jira SHALL be renderable in the same three formats. The supported Markdown subset is: headings (levels 1–6), paragraphs, bullet and ordered lists, fenced code blocks (preserving the language), blockquotes, hard line breaks, and the inline constructs bold, italic, inline code, and links.

Format semantics for writing on Jira Cloud:

- `markdown`: the input string's Markdown subset SHALL be converted to the corresponding ADF nodes; constructs outside the subset SHALL degrade gracefully to their plain-text content — conversion SHALL never fail on unsupported constructs. Plain text without Markdown constructs SHALL convert to simple paragraphs.
- `text`: the input string SHALL be taken literally, one paragraph per line, with no Markdown interpretation.
- `adf`: the input SHALL be an ADF document, given either as a JSON object or as a JSON-encoded string, and SHALL be sent to Jira as-is. An input that is not a valid ADF `doc` (or an unparsable JSON string) SHALL be rejected as invalid input before any Jira call.

Format semantics for reading on Jira Cloud: `markdown` SHALL render ADF to the Markdown subset with nodes outside the subset degrading to their text content, `text` SHALL render plain text with formatting dropped, and `adf` SHALL return the raw ADF document.

On Jira Data Center, rich-text fields are plain strings: written values for `markdown` and `text` SHALL be passed through unchanged and read values SHALL be returned unchanged regardless of the requested format; writing with format `adf` SHALL be rejected as invalid input, since Data Center has no ADF representation.

#### Scenario: Markdown description becomes structured ADF on Cloud

- **WHEN** `create-work-item` is invoked on a Jira Cloud connection with a description containing a heading, a bullet list, a fenced code block with a language, and a link
- **THEN** the created issue's ADF description contains the corresponding heading, bulletList, codeBlock (with the language attribute), and link-marked text nodes

#### Scenario: Plain text stays plain paragraphs

- **WHEN** a description containing only plain text lines is written on a Jira Cloud connection
- **THEN** the ADF document contains simple paragraphs, as before

#### Scenario: Literal text is not Markdown-parsed

- **WHEN** a description containing Markdown-significant characters (e.g. `# not a heading`) is written on a Jira Cloud connection with format `text`
- **THEN** the ADF document contains the literal text as paragraphs, with no heading or other Markdown interpretation

#### Scenario: An ADF document is written as-is

- **WHEN** a description is written on a Jira Cloud connection with format `adf`, as an ADF object or a JSON-encoded ADF string
- **THEN** exactly that ADF document is sent to Jira

#### Scenario: Invalid ADF input is rejected

- **WHEN** a rich-text input with format `adf` is not a valid ADF `doc` (or is an unparsable JSON string)
- **THEN** the action fails with an input validation error before any Jira call

#### Scenario: ADF reads back as Markdown

- **WHEN** `get-work-item` reads a Cloud issue whose ADF description contains a heading, a list, a code block, and a link, with `descriptionFormat: markdown`
- **THEN** the output description is Markdown containing the equivalent heading, list items, fenced code block, and link

#### Scenario: Unsupported constructs degrade to text

- **WHEN** a Cloud ADF description contains nodes outside the supported subset (e.g. a table or mention)
- **THEN** the Markdown rendering includes their text content and the conversion succeeds

#### Scenario: Data Center passes strings through

- **WHEN** a description is written to or read from a Jira Data Center connection with format `markdown` or `text`
- **THEN** the string is transmitted and returned unchanged in both directions

#### Scenario: ADF writes are rejected on Data Center

- **WHEN** a rich-text input with format `adf` is written on a Jira Data Center connection
- **THEN** the action fails with an input validation error explaining that ADF requires Jira Cloud

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
