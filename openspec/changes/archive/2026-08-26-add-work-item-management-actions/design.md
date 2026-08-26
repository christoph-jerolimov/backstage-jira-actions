# Design: Work Item Management Actions and Table Outputs

## Context

See proposal.md for motivation. Everything builds on established seams: `JiraClient` owns endpoints and per-product differences, `toWriteValue`/`toReadDescription` own rich-text handling, actions live one-per-module with `register*Action({actionsRegistry, connections, catalog?})`, and the templates follow a fixed shape enforced by fixture tests. Jira specifics that matter here: `PUT /issue/{key}` accepts an `update` section (`{update: {labels: [{add: 'x'}, {remove: 'y'}]}}`) alongside or instead of `fields`, and mixing `fields.labels` with `update.labels` in one request is a Jira error — which shapes the update-work-item validation. Comments come from `GET /issue/{key}/comment` (ADF bodies on Cloud v3, strings on Data Center v2, `author.displayName`). Cloud project search supports `query` (name/key matching) and `expand=description`; Data Center's `GET /project` returns everything and is filtered client-side.

## Goals / Non-Goals

**Goals:**

- Five small actions that stay thin over new `JiraClient` methods; label edits always incremental via the `update` section.
- `add-label`/`remove-label` report the resulting labels (one read-back `GET` with `fields=labels`) so agents see the effect.
- Table outputs generated with the same `{% for %}` templating already proven for the list blocks.

**Non-Goals:**

- No bulk label actions (one label per invocation on the dedicated actions; `update-work-item`'s `addLabels`/`removeLabels` cover multi-label edits).
- No comment pagination cursors (bounded `maxResults` only), no comment editing/deletion, no parent clearing (set only, matching the request).
- No `entityRef` on the new actions (all are issue-key-scoped).

## Decisions

### D1: Client methods

- `getComments(issueKey, {maxResults})` → `GET /issue/{key}/comment?maxResults=N`, normalizing to `{id, author?, body (raw), created?, updated?}`; the action maps bodies through the existing `toReadDescription` logic (exposed as a small public `readRichText(value, format)` on the client so comments and descriptions share it).
- `editLabels(issueKey, {add?, remove?})` → `PUT /issue/{key}` with `{update: {labels: [...adds as {add}, ...removes as {remove}]}}`, then a read-back `GET ?fields=labels` returning the resulting labels. Used by `add-label`, `remove-label`, and `update-work-item`'s incremental inputs.
- `setParent(issueKey, parentKey)` → `PUT /issue/{key}` with `{fields: {parent: {key}}}`.
- `rename` reuses `updateIssue(key, {summary})` — no new method.
- `listProjects({maxResults, name?})` — Cloud: `GET /project/search` with `maxResults`, `expand=description`, and `query=name` when given; Data Center: `GET /project?expand=description` filtered client-side (case-insensitive substring on name and key) and truncated. `JiraProject` gains `url` (constructed as `https://<host>/browse/<KEY>`, host-portable) and `description?`.

### D2: update-work-item label semantics

`addLabels`/`removeLabels` join the updatable-field set. Validation order: at-least-one-updatable check (now including the two new inputs), then the `labels` XOR (`addLabels`|`removeLabels`) conflict check — both before any Jira call. Since one `PUT` can carry both `fields` and `update` sections, `updateIssue` gains an optional `labelEdits` parameter that adds the `update.labels` section to the same request, keeping the action a single round-trip even when incremental label edits accompany other field changes. The dedicated label actions use `editLabels` instead (single label, plus read-back).

### D3: New action shapes

| action               | inputs                                    | output               | attributes           |
| -------------------- | ----------------------------------------- | -------------------- | -------------------- |
| get-comments         | issueKey, bodyFormat?, maxResults?, host? | key, url, comments[] | readOnly, idempotent |
| add-label            | issueKey, label, host?                    | key, url, labels     | idempotent           |
| remove-label         | issueKey, label, host?                    | key, url, labels     | idempotent           |
| rename-work-item     | issueKey, summary, host?                  | key, summary, url    | idempotent           |
| set-work-item-parent | issueKey, parentKey, host?                | key, parentKey, url  | idempotent           |

All non-read actions keep `destructive: false`, matching the existing write actions. Comment entries: `{id, author?, body (string or ADF object per bodyFormat), created?, updated?}`.

### D4: Table outputs in the templates

The first text block of the three list templates becomes a Markdown table: a literal header row + separator, then one `{% for %}` row per item, e.g. for projects:

```
| Key | Name | Description |
| --- | --- | --- |
{% for p in steps.invoke.output.projects %}| [${{ p.key }}](${{ p.url }}) | ${{ p.name }} | ${{ p.description }} |
{% endfor %}
```

`undefined` optional cells render as empty strings in nunjucks. `get-comments` renders sections instead: `**${{ c.author }}** — ${{ c.created }}` followed by the body and a rule between comments. Rendering is verified against the `nunjitsu` renderer with sample and empty outputs, as before. Fixture tests change accordingly: the LIST assertions check for a `| --- |` separator row and the specified header columns (and linked-key cells for projects/search), plus the per-comment shape for `get-comments`; the templates count grows to thirteen.

Pipe characters in Jira data can cosmetically break a table row — accepted as before; the JSON block carries the exact data.

### D5: Testing

- Client: msw tests for `getComments` (both products' body shapes), `editLabels` (update-section body + read-back), `setParent`, the combined `updateIssue` with `labelEdits`, and `listProjects` filtering/expansion per product.
- Actions: registry-mock tests per new action covering each spec scenario (including idempotent label cases via Jira's set semantics — asserted on the request/read-back, since Jira owns the set behavior), the update-work-item label-conflict and incremental scenarios, and the list-projects filter.
- Templates: fixture tests for the thirteen-template inventory and the table/section output shapes; nunjitsu render checks for the four reworked/new first blocks.

## Risks / Trade-offs

- [Read-back after label edits adds a second request] → Accepted for the resulting-labels output; it is one bounded `GET` with a single field.
- [Cloud `query` matching for `/project/search` may match more than name/key substrings] → The client applies the same client-side name/key filter after the server query on both products, making behavior uniform; the server `query` just pre-narrows on Cloud.
- [Project browse URL construction assumes `https://<host>/browse/<KEY>` redirects to the project] → Standard Jira behavior on both products; the JSON block includes the raw data if an instance differs.

## Migration Plan

Purely additive: merge, restart backend (templates re-ingest). Rollback = revert the commit.

## Open Questions

None.
