# Design: Markdown List Outputs for Read-Operation Templates

## Context

See proposal.md for motivation. Template `output.text` entries render as Markdown in the scaffolder run view, and the scaffolder templates them with nunjucks (`nunjitsu`'s `createTemplateRenderer`, used by `NunjucksWorkflowRunner`) — verified directly against the installed package that `{% for %}` block tags compose with the `${{ }}` variable delimiters and produce clean per-line output. The three list templates currently emit a single `Result` text block with `${{ steps.invoke.output | dump(2) }}`.

## Goals / Non-Goals

**Goals:**

- A readable first block per list template, using only templating (no plugin code), safe when the result list is empty.
- Keep the raw JSON as the second block for debugging and copy/paste.

**Non-Goals:**

- No changes to `get-work-item` (single item, description already Markdown) or the write-action templates.
- No output changes in the actions themselves — this is presentation in the test templates only.

## Decisions

### D1: Per-template Markdown list blocks via `{% for %}`

Each of the three templates replaces its single `Result` block with two blocks:

- `list-projects` — title `Projects`:
  ```
  {% for p in steps.invoke.output.projects %}- **${{ p.key }}** — ${{ p.name }} (id ${{ p.id }})
  {% endfor %}
  ```
- `list-issue-types` — title `Issue types`: `- **${{ t.name }}**` with ` (sub-task)` appended via `{% if t.subtask %}` and the description appended when present.
- `search-work-items` — title `Work items`: `- [${{ i.key }}](${{ i.url }}) — ${{ i.summary }} (${{ i.status }})` per item.

The second block keeps the existing shape, retitled `JSON`, with the ` ```json … | dump(2) ` fence. Loop bodies live on one line per bullet so the rendered Markdown is a clean list; an empty result array renders an empty first block rather than failing.

### D2: Fixture-test assertions on the output shape

`templates.test.ts` gains a check that the three list templates have exactly two `output.text` entries, the first containing a `{% for` loop over the action's collection field and no `dump`, the second containing `| dump(2)`. The existing "renders the result" assertion (some text block references `steps.invoke.output`) continues to hold for all eight templates.

## Risks / Trade-offs

- [Block-tag templating in output text relies on scaffolder internals staying nunjucks-compatible] → Verified against the current implementation; if a future upgrade drops block tags the templates fail visibly in the run output and the JSON block still renders.
- [Markdown-significant characters in Jira data (project names, summaries) could distort the list rendering] → Cosmetic only, and the JSON block always carries the exact data.

## Migration Plan

Template YAML and test changes only: merge and restart the backend to re-ingest the templates. Rollback = revert the commit.

## Open Questions

None.
