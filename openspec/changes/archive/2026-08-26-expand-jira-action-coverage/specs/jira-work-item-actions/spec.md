# jira-work-item-actions Delta

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Jira actions are registered in the Actions Registry

The system SHALL register the Jira work item actions in the Backstage Actions Registry under the `jira-actions` plugin, so that they are discoverable and invokable through the actions service, and exposed via the MCP actions backend when the `jira-actions` plugin is listed in `backend.actions.pluginSources`. The registered actions SHALL be `create-work-item`, `update-work-item`, `rename-work-item`, `set-work-item-parent`, `delete-work-item`, `get-work-item`, `search-work-items`, `search-users`, `add-comment`, `get-comments`, `add-label`, `remove-label`, `link-work-items`, `list-link-types`, `list-transitions`, `transition-work-item`, `list-projects`, `list-issue-types`, `list-fields`, `get-worklogs`, `add-worklog`, `add-watcher`, `remove-watcher`, `list-boards`, `list-sprints`, and `move-to-sprint`. Each action SHALL declare a title, a description, and typed input and output schemas so that callers (including AI agents) can discover how to use it without external documentation. The purely reading actions (`get-work-item`, `search-work-items`, `search-users`, `get-comments`, `list-link-types`, `list-transitions`, `list-projects`, `list-issue-types`, `list-fields`, `get-worklogs`, `list-boards`, `list-sprints`) SHALL be marked read-only in their registry attributes. `delete-work-item` SHALL be the only action marked destructive.

#### Scenario: Actions are discoverable

- **WHEN** the backend starts with the Jira actions plugin installed and `jira-actions` listed in `backend.actions.pluginSources`
- **THEN** all twenty-six actions are listed by the actions service with their input and output schemas

#### Scenario: Read actions are marked read-only

- **WHEN** the registered actions are listed
- **THEN** the twelve reading actions carry read-only attributes, and the writing actions do not

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
- `customFields` (optional): an object mapping Jira field ids (e.g. `customfield_10020`, as discoverable via `list-fields`) to values, passed to Jira verbatim as additional issue fields.
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

#### Scenario: Create with custom fields

- **WHEN** the action is invoked with `customFields: { customfield_10020: 5 }`
- **THEN** the create request sent to Jira carries `customfield_10020: 5` as an issue field

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
- `customFields` (optional): an object mapping Jira field ids to new values, passed to Jira verbatim as issue fields; counts as an updatable field.
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

#### Scenario: Update custom fields

- **WHEN** the action is invoked with only `issueKey` and `customFields`
- **THEN** the update is accepted and the request sent to Jira carries the custom field values verbatim

#### Scenario: No fields to update

- **WHEN** the action is invoked with only `issueKey` and no updatable fields
- **THEN** the action fails with an input validation error before any Jira API call is made

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an issue key that Jira does not know
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: Get work item action

The system SHALL provide a `get-work-item` action that reads a single Jira issue by its key. The input SHALL accept `issueKey` (required), `descriptionFormat` (optional: `markdown`, `adf`, or `text`, defaulting to `markdown`), `customFields` (optional: a list of Jira field ids to read in addition to the standard fields), and `host` (optional, as for the other actions). On success, the output SHALL include the issue `key`, `summary`, `status` (status name), `issueType` (type name), `url`, and — when present on the issue — `description` rendered in the requested format per the rich text conversion requirement (a string for `markdown` and `text`, the raw ADF document for `adf` on Jira Cloud), `assignee` (account ID on Cloud, username on Data Center), `labels`, `parentKey`, the `created` and `updated` timestamps, the issue's `links` (each with the resolved link `type` name, the relation `direction` description as it reads from this issue, e.g. `blocks` or `is blocked by`, and the linked issue's `key`), and `customFields` (an object with the requested field ids and their raw values) when custom fields were requested.

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
