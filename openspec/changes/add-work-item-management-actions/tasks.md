# Tasks: Work Item Management Actions and Table Outputs

## 1. Client extensions

- [ ] 1.1 Add `getComments` (per-product body shapes, author display name, maxResults) and expose the shared rich-text read helper (`readRichText`) on `JiraClient`; verify with msw tests for both products and the 404 case.
- [ ] 1.2 Add `editLabels` (update-section PUT + labels read-back), `setParent`, an optional `labelEdits` parameter on `updateIssue` (single PUT carrying fields + update), and extend `listProjects` with the `name` filter, `expand=description`, and `url`/`description` on `JiraProject`; verify with msw tests asserting the request bodies, the read-back, and per-product filtering.

## 2. New actions (spec: jira-work-item-actions)

- [ ] 2.1 Implement and register `get-comments` (bodyFormat selector reusing the rich-text read rendering, readOnly attributes); verify with registry-mock tests for the default-markdown, adf, and unknown-issue scenarios.
- [ ] 2.2 Implement and register `add-label` and `remove-label` (incremental update, resulting-labels output, idempotent attributes); verify with registry-mock tests covering the add/remove and unknown-issue scenarios.
- [ ] 2.3 Implement and register `rename-work-item` and `set-work-item-parent`; verify with registry-mock tests for the rename, set-parent, Jira-rejection, and unknown-issue scenarios.

## 3. Extended actions (spec: jira-work-item-actions)

- [ ] 3.1 Add `addLabels`/`removeLabels` to `update-work-item` (counting as updatable fields, conflict with `labels`, single-PUT wiring); verify with registry-mock tests for the incremental, conflict, and lone-issueKey scenarios.
- [ ] 3.2 Add the `name` filter and `url`/`description` output to `list-projects`; verify with registry-mock tests for the filtered and unfiltered scenarios on both products.
- [ ] 3.3 Update the registration: all thirteen actions registered, discovery test updated with the new read-only set.

## 4. Templates, docs & verification

- [ ] 4.1 Create the five new template files, add them to `all.yaml`, and rework the three list templates' first blocks into Markdown tables (linked keys for projects/search) plus the per-comment sections for `get-comments`; verify all files parse and the four new/reworked first blocks render correctly via `nunjitsu` with sample and empty outputs.
- [ ] 4.2 Update the template fixture tests (thirteen-template inventory, table-column and section assertions, format/entity metadata for the new actions) and the plugin `README.md` action table and notes; verify the suite and `yarn prettier --check` pass.
- [ ] 4.3 Run the verification suite — `yarn tsc`, plugin lint and tests, `yarn build:backend` — and boot-smoke-test the backend confirming thirteen actions register and thirteen templates ingest; verify all pass.
