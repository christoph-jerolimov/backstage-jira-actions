## MODIFIED Requirements

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
- `assignee` (optional): new assignee (account ID or username).
- `issueType` (optional): new issue type name.
- `host` (optional): the Jira host to target when multiple connections are configured.

At least one updatable field MUST be provided; an invocation naming only `issueKey` (with or without `descriptionFormat`) SHALL be rejected as invalid input. On success, the output SHALL include the issue `key` and a browseable `url`.

#### Scenario: Update the summary of an issue

- **WHEN** the action is invoked with `issueKey: PROJ-123` and a new `summary`
- **THEN** the Jira issue PROJ-123 has its summary replaced and the output contains the issue key and URL

#### Scenario: Update with a literal text description

- **WHEN** the action is invoked with a `description` and `descriptionFormat: text` on a Jira Cloud connection
- **THEN** the description is stored as literal paragraphs without Markdown interpretation

#### Scenario: No fields to update

- **WHEN** the action is invoked with only `issueKey` and no updatable fields
- **THEN** the action fails with an input validation error before any Jira API call is made

#### Scenario: Issue does not exist

- **WHEN** the action is invoked with an issue key that Jira does not know
- **THEN** the action fails with a NotFound-style error naming the issue key

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
