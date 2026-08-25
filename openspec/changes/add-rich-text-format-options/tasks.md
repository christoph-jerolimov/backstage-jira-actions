# Tasks: Selectable Rich Text Formats

## 1. Conversion seam

- [ ] 1.1 Add the `RichTextFormat` type and `toWriteValue`/`parseAdfInput` helpers to `src/lib/adf.ts` (markdown/text/adf semantics per product, JSON-string ADF parsing, structural `doc` validation, InputErrors for non-string markdown/text values and for adf on Data Center); verify with unit tests covering every format×product combination and each rejection case.
- [ ] 1.2 Wire the seam into `JiraClient`: `descriptionFormat` on `JiraWorkItemFields`, `bodyFormat` parameter on `addComment`, and the `adf` read format on `getIssue` (raw document on Cloud, string passthrough on Data Center); verify with msw tests for literal-text writes, verbatim ADF writes (object and JSON string), and the raw-ADF read.

## 2. Actions (spec: jira-work-item-actions)

- [ ] 2.1 Add `descriptionFormat` to `create-work-item` and `update-work-item` (union description input, enum defaulting to markdown, lone `descriptionFormat` not counting as an updatable field) and `bodyFormat` to `add-comment`; verify with registry-mock tests for the ADF create/comment scenarios, the literal-text update scenario, the Data Center adf rejection, and the lone-format update rejection.
- [ ] 2.2 Extend `get-work-item`'s `descriptionFormat` enum with `adf` and widen the description output to string-or-object; verify with registry-mock tests that markdown stays the default and `adf` returns the raw document.

## 3. Templates, docs & verification

- [ ] 3.1 Add the format enum parameters to the `add-comment`, `create-work-item`, `update-work-item`, and `get-work-item` templates (with `adf` added to get's existing enum) and update the README rich-text notes; verify the template fixture tests (extended with the format-parameter assertions) and `yarn prettier --check` pass.
- [ ] 3.2 Run the verification suite — `yarn tsc`, plugin lint and tests, `yarn build:backend` — and boot-smoke-test the backend; verify all pass.
