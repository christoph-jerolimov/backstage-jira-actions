# Markdown List Outputs for the Read-Operation Templates

## Why

The test templates render their action result only as a JSON dump. For the read operations that return lists — `list-projects`, `list-issue-types`, `search-work-items` — that makes the most common use ("what projects are there?") needlessly hard to read in the run output. A human-readable Markdown list first, with the raw JSON kept as a second block, serves both audiences.

## What Changes

- The `list-projects`, `list-issue-types`, and `search-work-items` templates render **two** text outputs:
  1. A Markdown list of the results (one bullet per item — e.g. `**PROJ** — Project One` for projects, the type name with its subtask flag for issue types, and a linked `key — summary (status)` line per search hit), built with the scaffolder's nunjucks `{% for %}` templating over the step output.
  2. The existing pretty-printed JSON dump, as the second block titled `JSON`.
- The other templates are unchanged: `get-work-item` returns a single item (its description is already Markdown), and the write actions' outputs are small key/URL records where the JSON dump is adequate. The user-named scope ("read operations like list-issue-types and list-projects") is interpreted as the list-returning read operations.
- The template fixture tests assert the two-block output shape for the three list templates.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-action-templates`: the per-action template requirement gains the two-block output rule for list-returning read actions (Markdown list first, JSON dump second).

## Impact

- **Modified code**: the three template YAML files in `examples/jira-actions-templates/` and the fixture tests in `plugins/jira-actions-backend/src/templates.test.ts`. No plugin/backend code changes.
- **Dependencies/config**: none.
- **Feasibility note**: verified against the scaffolder's actual templater (`nunjitsu`, used by `NunjucksWorkflowRunner`) that `{% for %}` block tags render correctly alongside `${{ }}` expressions in output text.
