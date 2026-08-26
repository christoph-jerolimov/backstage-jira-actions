# Work Item Management Actions and Table Outputs

## Why

Agents can create, read, and search work items but still lack common management moves: reading a ticket's conversation, adjusting labels without replacing the whole list, renaming a ticket, or re-parenting it. And `list-projects` returns only bare key/name/id with no way to narrow a large instance. On the presentation side, the list templates render flat bullets where a table with named columns (and linked keys) would be far more scannable.

## What Changes

Five new actions on the `jira-actions` plugin (thirteen total):

- `get-comments`: read the comments of an issue (author, body rendered per the rich text formats with a `bodyFormat` selector, created/updated timestamps). Read-only.
- `add-label` / `remove-label`: add or remove a single label on an issue via Jira's incremental label update (no full-list replace); the output reports the issue's resulting labels.
- `rename-work-item`: change only the summary of an issue.
- `set-work-item-parent`: change only the parent of an issue.

Extended actions:

- `update-work-item` gains `addLabels` and `removeLabels` inputs (incremental label edits, usable alongside the other fields; conflicting with the full-replace `labels` input).
- `list-projects` gains a `name` filter (substring match on project name/key) and its output entries gain `description` (when Jira provides one) and a browseable `url`.

Template/example changes:

- Five new test templates, one per new action, following the established pattern.
- The list templates switch from bullet lists to **Markdown tables** as their first output block (JSON dump stays second):
  - `list-issue-types`: columns Name, Description, Sub-task.
  - `list-projects`: columns Key (linked to the project URL), Name, Description.
  - `search-work-items`: columns Key (linked to the issue URL), Summary, Status, Type, Assignee — all six response attributes, with `url` carried by the key link.
  - `get-comments` joins the two-block rule with a per-comment rendering (author, timestamp, body) rather than a table, since comment bodies are multi-line.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-work-item-actions`: five ADDED action requirements; the registration requirement covers thirteen actions (with `get-comments` read-only); `update-work-item` gains the incremental label inputs; `list-projects` gains the name filter and richer output.
- `jira-action-templates`: one template per action now means thirteen; the list-output rule becomes Markdown tables with the specified columns (per-comment sections for `get-comments`).

## Impact

- **Modified code**: `plugins/jira-actions-backend` — `JiraClient` (comments endpoint, incremental label update, parent update, project search/filter with descriptions), five new action modules, `update-work-item`/`list-projects` extensions, plugin registration, README, tests. `examples/jira-actions-templates/` — five new template files, `all.yaml`, and the three reworked table outputs.
- **APIs used**: `GET /issue/{key}/comment`, `PUT /issue/{key}` with an `update.labels` section and with `fields.parent`, `GET /project/search?query=…&expand=description` (Cloud) / `GET /project?expand=description` with client-side filtering (Data Center).
- **Dependencies/config**: none.
- **Behavior**: purely additive for existing callers; `list-projects` output gains fields but keeps the existing ones.
