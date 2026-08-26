## ADDED Requirements

### Requirement: Markdown rich text conversion

Description and comment inputs SHALL be interpreted as Markdown, and rich-text fields read back from Jira SHALL be renderable as Markdown. The supported Markdown subset is: headings (levels 1–6), paragraphs, bullet and ordered lists, fenced code blocks (preserving the language), blockquotes, hard line breaks, and the inline constructs bold, italic, inline code, and links.

Per-product behavior:

- On Jira Cloud, written Markdown SHALL be converted to the corresponding ADF nodes, and ADF fields read back SHALL be rendered to the same Markdown subset. Markdown constructs outside the subset SHALL degrade gracefully to their plain-text content, and ADF nodes outside the subset (e.g. tables, media, mentions) SHALL degrade to their text content — conversion SHALL never fail on unsupported constructs.
- On Jira Data Center, rich-text fields are plain strings: written values SHALL be passed through unchanged and read values SHALL be returned unchanged, regardless of the requested format.

Plain text without Markdown constructs SHALL convert to simple paragraphs, preserving the previous plain-text behavior.

#### Scenario: Markdown description becomes structured ADF on Cloud

- **WHEN** `create-work-item` is invoked on a Jira Cloud connection with a description containing a heading, a bullet list, a fenced code block with a language, and a link
- **THEN** the created issue's ADF description contains the corresponding heading, bulletList, codeBlock (with the language attribute), and link-marked text nodes

#### Scenario: Plain text stays plain paragraphs

- **WHEN** a description containing only plain text lines is written on a Jira Cloud connection
- **THEN** the ADF document contains simple paragraphs, as before

#### Scenario: ADF reads back as Markdown

- **WHEN** `get-work-item` reads a Cloud issue whose ADF description contains a heading, a list, a code block, and a link, with `descriptionFormat: markdown`
- **THEN** the output description is Markdown containing the equivalent heading, list items, fenced code block, and link

#### Scenario: Unsupported constructs degrade to text

- **WHEN** a Cloud ADF description contains nodes outside the supported subset (e.g. a table or mention)
- **THEN** the Markdown rendering includes their text content and the conversion succeeds

#### Scenario: Data Center passes strings through

- **WHEN** a description is written to or read from a Jira Data Center connection
- **THEN** the string is transmitted and returned unchanged in both directions

## MODIFIED Requirements

### Requirement: Create work item action

The system SHALL provide a `create-work-item` action that creates a Jira issue. The input SHALL accept:

- `projectKey` (optional): the Jira project key, e.g. `PROJ`.
- `entityRef` (optional): a catalog entity ref whose `jira/project-key` annotation identifies the project.
- `issueType` (required): the issue type name, e.g. `Story`, `Bug`, `Task`.
- `summary` (required): the issue summary line.
- `description` (optional): Markdown description of the issue, converted per the Markdown rich text conversion requirement.
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

### Requirement: Update work item action

The system SHALL provide an `update-work-item` action that modifies an existing Jira issue identified by its issue key. The input SHALL accept:

- `issueKey` (required): the key of the issue to update, e.g. `PROJ-123`.
- `summary` (optional): new summary.
- `description` (optional): new Markdown description, converted per the Markdown rich text conversion requirement.
- `labels` (optional): full replacement list of labels.
- `assignee` (optional): new assignee (account ID or username).
- `issueType` (optional): new issue type name.
- `host` (optional): the Jira host to target when multiple connections are configured.

At least one updatable field MUST be provided; an invocation naming only `issueKey` SHALL be rejected as invalid input. On success, the output SHALL include the issue `key` and a browseable `url`.

#### Scenario: Update the summary of an issue

- **WHEN** the action is invoked with `issueKey: PROJ-123` and a new `summary`
- **THEN** the Jira issue PROJ-123 has its summary replaced and the output contains the issue key and URL

#### Scenario: No fields to update

- **WHEN** the action is invoked with only `issueKey` and no updatable fields
- **THEN** the action fails with an input validation error before any Jira API call is made

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an issue key that Jira does not know
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: Get work item action

The system SHALL provide a `get-work-item` action that reads a single Jira issue by its key. The input SHALL accept `issueKey` (required), `descriptionFormat` (optional: `markdown` or `text`, defaulting to `markdown`), and `host` (optional, as for the other actions). On success, the output SHALL include the issue `key`, `summary`, `status` (status name), `issueType` (type name), `url`, and — when present on the issue — `description` rendered in the requested format per the Markdown rich text conversion requirement, `assignee` (account ID on Cloud, username on Data Center), `labels`, `parentKey`, and the `created` and `updated` timestamps.

#### Scenario: Read an existing issue

- **WHEN** the action is invoked with the key of an existing issue
- **THEN** the output contains the issue's key, summary, status name, issue type name, and browseable URL, with optional fields included when the issue has them

#### Scenario: Cloud description is returned as Markdown by default

- **WHEN** an issue on a Jira Cloud connection has a rich-text (ADF) description and no `descriptionFormat` is given
- **THEN** the output `description` is the Markdown rendering of that document, not an ADF object

#### Scenario: Cloud description is returned as plain text

- **WHEN** the action is invoked with `descriptionFormat: text` for a Cloud issue with a rich-text (ADF) description
- **THEN** the output `description` is the plain-text rendering with formatting dropped, not an ADF object

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key

### Requirement: Add comment action

The system SHALL provide an `add-comment` action that adds a comment to an existing Jira issue. The input SHALL accept `issueKey` (required), `body` (required, Markdown), and `host` (optional). The comment body SHALL be converted per the Markdown rich text conversion requirement — an ADF document on Jira Cloud, the unchanged string on Jira Data Center. On success, the output SHALL include the issue `key`, the created comment's `commentId`, and the issue `url`.

#### Scenario: Comment on an existing issue

- **WHEN** the action is invoked with an issue key and a body
- **THEN** a comment with that text is added to the issue and the output contains the issue key, the new comment id, and the issue URL

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an unknown issue key
- **THEN** the action fails with a NotFound-style error naming the issue key
