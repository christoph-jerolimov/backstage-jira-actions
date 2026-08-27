# jira-work-item-actions Specification

## Purpose

Provides Backstage Actions Registry actions to create and modify Jira work items (stories, bugs, tasks, and other issue types), so any registry consumer — including the MCP actions endpoint — can manage Jira tickets through Backstage.

## Requirements

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

### Requirement: Actions use the configured Jira connection

Actions SHALL resolve their Jira connection through the Jira connections capability. When no `host` input is given, the default (first configured) Jira connection SHALL be used; when a `host` input is given, the connection for that host SHALL be used. If no usable connection exists, the action SHALL fail with an error directing the operator to the `connections` configuration.

#### Scenario: No Jira connection configured

- **WHEN** an action is invoked while no `connections` entry with `type: jira` exists
- **THEN** the action fails with an error explaining that a Jira connection must be configured in the `connections` section

#### Scenario: Targeting a specific host

- **WHEN** two Jira connections are configured and an action is invoked with the `host` input set to the second connection's host
- **THEN** the Jira API calls are made against that host using that connection's credentials

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

### Requirement: Search work items action

The system SHALL provide a `search-work-items` action that finds Jira issues either by a raw `jql` input or by simplified filter inputs: `projectKey` or `entityRef` (a catalog entity ref whose `jira/project-key` annotation identifies the project), `text` (free-text match on summary/description), `status`, `issueType`, `assignee`, and `labels`. When `jql` is given it SHALL be used as-is and the simplified filters SHALL be rejected as conflicting input; when it is absent, at least one filter MUST be provided and the action SHALL build the equivalent JQL. The input SHALL accept `maxResults` (default 25, capped at 100), `pageToken` (optional: an opaque cursor from a previous invocation's output), and `host`. On success, the output SHALL include an `items` array — each item with `key`, `summary`, `status`, `issueType`, `url`, and `assignee` when present — ordered by most recently updated when the JQL is built from filters, and a `nextPageToken` cursor when more results are available beyond the returned page; the cursor, passed back with an otherwise identical invocation, SHALL return the next page.

#### Scenario: Search by simplified filters

- **WHEN** the action is invoked with `projectKey: PROJ` and `status: "In Progress"`
- **THEN** the issues matching that project and status are returned as items with key, summary, status, issue type, and URL

#### Scenario: Search by entity ref

- **WHEN** the action is invoked with `entityRef: component:default/my-service` whose entity carries `jira/project-key: PROJ`
- **THEN** the search is restricted to project `PROJ`

#### Scenario: Search by raw JQL

- **WHEN** the action is invoked with a `jql` input and no simplified filters
- **THEN** that JQL is sent to Jira unchanged and the matching issues are returned

#### Scenario: Fetch the next page

- **WHEN** a search returns a `nextPageToken` and the action is invoked again with that token as `pageToken`
- **THEN** the next page of results is returned, and `nextPageToken` is absent once no further results remain

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

The system SHALL provide a `get-comments` action that reads the comments of a Jira issue. The input SHALL accept `issueKey` (required), `bodyFormat` (optional: `markdown`, `adf`, or `text`, defaulting to `markdown`, applied to each comment body per the rich text conversion requirement), `maxResults` (default 50, capped at 100), `pageToken` (optional: an opaque cursor from a previous invocation's output), and `host` (optional). On success, the output SHALL include the issue `key`, its `url`, a `comments` array — each entry with the comment `id`, `author` (display name when available), `body` in the requested format, and the `created` and `updated` timestamps — and a `nextPageToken` cursor when more comments are available beyond the returned page.

#### Scenario: Read the comments of an issue

- **WHEN** the action is invoked with the key of an issue that has comments
- **THEN** the output lists the comments with id, author, body rendered as Markdown by default, and timestamps

#### Scenario: Comment bodies honor the format selector

- **WHEN** the action is invoked with `bodyFormat: adf` on a Jira Cloud connection
- **THEN** each comment body is the raw ADF document

#### Scenario: Fetch the next page of comments

- **WHEN** a read returns a `nextPageToken` and the action is invoked again with that token as `pageToken`
- **THEN** the next page of comments is returned, and `nextPageToken` is absent once no further comments remain

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

### Requirement: Search users action

The system SHALL provide a `search-users` action that finds Jira users so that callers can resolve display names to assignable identities. The input SHALL accept `query` (required: matched against display names, emails, and usernames per Jira's user search), `maxResults` (default 25, capped at 100), and `host` (optional). On success, the output SHALL include a `users` array — each entry with `id` (the account ID on Jira Cloud, the username on Data Center — the exact value usable as an `assignee` or watcher input), `displayName`, `email` when Jira provides one, and an `active` flag. An empty result SHALL be an empty array, not an error.

#### Scenario: Find a user by name

- **WHEN** the action is invoked with `query: jane`
- **THEN** the output lists the matching users with their assignable id, display name, and active flag

#### Scenario: Result ids are assignable

- **WHEN** a returned user's `id` is passed as the `assignee` input of `create-work-item` or `update-work-item` on the same connection
- **THEN** the assignment succeeds without further translation

#### Scenario: No match

- **WHEN** the action is invoked with a query matching no users
- **THEN** the output contains an empty `users` array

### Requirement: List transitions action

The system SHALL provide a `list-transitions` action that lists the workflow transitions currently available on a Jira issue, so that callers can plan a `transition-work-item` call without failing first. The input SHALL accept `issueKey` (required) and `host` (optional). On success, the output SHALL include the issue `key` and a `transitions` array — each entry with the transition `id`, `name`, and `toStatus` (the name of the status the transition leads to).

#### Scenario: List reachable transitions

- **WHEN** the action is invoked with the key of an existing issue
- **THEN** the output lists the currently available transitions with their names and target statuses

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: List link types action

The system SHALL provide a `list-link-types` action that lists the issue link types available on the Jira instance. The input SHALL accept `host` (optional). On success, the output SHALL include a `linkTypes` array — each entry with the link type `id`, `name` (e.g. `Blocks`), `inward` (e.g. `is blocked by`), and `outward` (e.g. `blocks`) descriptions.

#### Scenario: List available link types

- **WHEN** the action is invoked
- **THEN** the output lists the instance's link types with name, inward, and outward descriptions

### Requirement: Link work items action

The system SHALL provide a `link-work-items` action that creates a link between two Jira issues. The input SHALL accept `issueKey` (required), `targetKey` (required), `linkType` (required), and `host` (optional). The `linkType` SHALL be matched case-insensitively against the instance's link types by name, outward description, or inward description; when it matches an inward description, the link direction SHALL be reversed so that the created relation reads correctly (e.g. `issueKey` "is blocked by" `targetKey` links `targetKey` blocks `issueKey`). An unknown `linkType` SHALL fail with an error listing the available link types. On success, the output SHALL include `key` (the issue), `targetKey`, the resolved link type `linkType` (its name), and the issue `url`.

#### Scenario: Link two issues by type name

- **WHEN** the action is invoked with `issueKey: PROJ-1`, `targetKey: PROJ-2`, and `linkType: Blocks`
- **THEN** a link is created so that PROJ-1 blocks PROJ-2, and the output reports both keys and the resolved type

#### Scenario: Link using the inward description

- **WHEN** the action is invoked with `linkType: "is blocked by"`
- **THEN** the link is created in the reversed direction so that the target issue blocks the source issue

#### Scenario: Unknown link type

- **WHEN** the action is invoked with a `linkType` that matches no link type name or description
- **THEN** the action fails with an error naming the requested type and listing the available link types, and no link is created

#### Scenario: Issue does not exist

- **WHEN** either issue key is unknown to Jira
- **THEN** the action fails with an error that includes Jira's error details

### Requirement: List fields action

The system SHALL provide a `list-fields` action that lists the fields defined on the Jira instance, including custom fields, so that callers can discover custom field ids for the `customFields` inputs. The input SHALL accept `name` (optional: a case-insensitive substring filter matched against field names and ids) and `host` (optional). On success, the output SHALL include a `fields` array — each entry with the field `id` (e.g. `customfield_10020`), `name`, a `custom` flag, and `type` when Jira provides a schema type.

#### Scenario: List fields including custom fields

- **WHEN** the action is invoked
- **THEN** the output lists the instance's fields with ids, names, and custom flags

#### Scenario: Filter fields by name

- **WHEN** the action is invoked with `name: "story point"`
- **THEN** only fields whose name or id matches the filter (case-insensitively) are returned

### Requirement: Get worklogs action

The system SHALL provide a `get-worklogs` action that reads the work log entries of a Jira issue. The input SHALL accept `issueKey` (required), `commentFormat` (optional: `markdown`, `adf`, or `text`, defaulting to `markdown`, applied to each worklog comment per the rich text conversion requirement), `maxResults` (default 50, capped at 100), and `host` (optional). On success, the output SHALL include the issue `key`, its `url`, and a `worklogs` array — each entry with the worklog `id`, `author` (display name when available), `timeSpent` (e.g. `2h 30m`), `timeSpentSeconds`, `started` timestamp, and `comment` in the requested format when present.

#### Scenario: Read the worklogs of an issue

- **WHEN** the action is invoked with the key of an issue that has logged work
- **THEN** the output lists the worklog entries with author, time spent, start timestamp, and comment

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: Add worklog action

The system SHALL provide an `add-worklog` action that logs work on a Jira issue. The input SHALL accept `issueKey` (required), `timeSpent` (required: a Jira duration string such as `2h 30m`), `comment` (optional rich text), `commentFormat` (optional: `markdown`, `adf`, or `text`, defaulting to `markdown`, per the rich text conversion requirement), `started` (optional ISO timestamp; defaults to Jira's own default when omitted), and `host` (optional). On success, the output SHALL include the issue `key`, the created `worklogId`, and the issue `url`.

#### Scenario: Log time on an issue

- **WHEN** the action is invoked with `issueKey: PROJ-1` and `timeSpent: "2h"`
- **THEN** a worklog entry of two hours is added and the output reports the issue key and the new worklog id

#### Scenario: Jira rejects the duration

- **WHEN** Jira rejects the `timeSpent` value as invalid
- **THEN** the action fails with an error that includes Jira's error details

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: Add watcher action

The system SHALL provide an `add-watcher` action that adds a user as a watcher of a Jira issue. The input SHALL accept `issueKey` (required), `user` (required: the account ID on Jira Cloud, the username on Data Center — as returned by `search-users`), and `host` (optional). On success, the output SHALL include the issue `key` and its `url`. Adding a user who already watches the issue SHALL succeed.

#### Scenario: Add a watcher

- **WHEN** the action is invoked with an issue key and a user id
- **THEN** the user is added as a watcher of the issue

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: Remove watcher action

The system SHALL provide a `remove-watcher` action that removes a user from the watchers of a Jira issue. The input SHALL accept `issueKey` (required), `user` (required, as for `add-watcher`), and `host` (optional). On success, the output SHALL include the issue `key` and its `url`.

#### Scenario: Remove a watcher

- **WHEN** the action is invoked with an issue key and a watching user's id
- **THEN** the user no longer watches the issue

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: List boards action

The system SHALL provide a `list-boards` action that lists the agile boards visible to the configured credentials via Jira's Agile API. The input SHALL accept `name` (optional: a case-insensitive filter on the board name), `projectKey` (optional: restrict to boards of that project), `maxResults` (default 50, capped at 100), and `host` (optional). On success, the output SHALL include a `boards` array — each entry with the board `id`, `name`, and `type` (e.g. `scrum`, `kanban`).

#### Scenario: List visible boards

- **WHEN** the action is invoked
- **THEN** the output lists the visible boards with id, name, and type

#### Scenario: Filter boards by project

- **WHEN** the action is invoked with `projectKey: PROJ`
- **THEN** only boards associated with project PROJ are returned

### Requirement: List sprints action

The system SHALL provide a `list-sprints` action that lists the sprints of an agile board. The input SHALL accept `boardId` (required), `state` (optional: `active`, `future`, or `closed`), `maxResults` (default 50, capped at 100), and `host` (optional). On success, the output SHALL include a `sprints` array — each entry with the sprint `id`, `name`, `state`, and, when present, `startDate`, `endDate`, and `goal`.

#### Scenario: List the sprints of a board

- **WHEN** the action is invoked with an existing board's id
- **THEN** the output lists that board's sprints with id, name, and state

#### Scenario: Filter sprints by state

- **WHEN** the action is invoked with `state: active`
- **THEN** only active sprints are returned

#### Scenario: Board does not exist

- **WHEN** the action is invoked with an unknown board id
- **THEN** the action fails with a NotFound-style error naming the board id

### Requirement: Move to sprint action

The system SHALL provide a `move-to-sprint` action that moves issues into a sprint via Jira's Agile API. The input SHALL accept `sprintId` (required), `issueKeys` (required: a non-empty list of at most 50 issue keys), and `host` (optional). On success, the output SHALL include the `sprintId` and the moved `issueKeys`.

#### Scenario: Move issues into a sprint

- **WHEN** the action is invoked with a sprint id and issue keys
- **THEN** those issues are moved into the sprint and the output reports the sprint id and keys

#### Scenario: Sprint does not exist

- **WHEN** the action is invoked with an unknown sprint id
- **THEN** the action fails with a NotFound-style error naming the sprint id

### Requirement: Delete work item action

The system SHALL provide a `delete-work-item` action that permanently deletes a Jira issue. The input SHALL accept `issueKey` (required), `deleteSubtasks` (optional boolean, default `false`: also delete the issue's sub-tasks), and `host` (optional). The action SHALL be marked destructive in its registry attributes. On success, the output SHALL include the deleted issue's `key`.

#### Scenario: Delete an issue

- **WHEN** the action is invoked with the key of an existing issue
- **THEN** the issue is permanently deleted and the output reports its key

#### Scenario: Issue has sub-tasks

- **WHEN** the action is invoked without `deleteSubtasks: true` on an issue that has sub-tasks
- **THEN** the action fails with an error that includes Jira's error details, and nothing is deleted

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: Actions are guarded by the permission framework

The system SHALL register three permissions with the Backstage permission framework — a read permission covering the read-only actions, a write permission covering the modifying actions, and a delete permission covering `delete-work-item` — so that operators can control access with permission policies. Every action SHALL authorize the invoking caller's credentials against its permission before any Jira API call; a denied decision SHALL fail the action with a NotAllowed-style error and no Jira call SHALL be made. Under Backstage's default allow-all policy, all actions SHALL continue to work unchanged.

#### Scenario: Permissions are registered

- **WHEN** the backend starts with the Jira actions plugin installed
- **THEN** the plugin's read, write, and delete permissions are registered with the permission framework

#### Scenario: A denied write is rejected before Jira is called

- **WHEN** the active permission policy denies the write permission for the caller and a write action is invoked
- **THEN** the action fails with a NotAllowed-style error and no Jira API call is made

#### Scenario: Default policy allows all actions

- **WHEN** no custom permission policy is installed
- **THEN** all actions behave as before, with no authorization failures

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
