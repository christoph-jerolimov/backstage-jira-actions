# Tasks: Markdown ↔ ADF Support

## 1. Converters

- [ ] 1.1 Add the `marked` dependency and implement `markdownToAdf` in `src/lib/adf.ts` (lexer-token mapping for headings, paragraphs, bullet/ordered lists, fenced code with language, blockquotes, hard breaks, and inline strong/em/code/link; unknown tokens degrade to text; plain text yields the previous paragraph shape); verify with unit tests per construct including the plain-text equivalence and degradation cases.
- [ ] 1.2 Implement `adfToMarkdown` (mirror rendering of the subset incl. one list nesting level and link/bold/italic/code marks; non-subset nodes degrade via text extraction); verify with per-node unit tests, degradation cases, and round-trip tests asserting `adfToMarkdown(markdownToAdf(md))` equals the normalized fixtures.

## 2. Client & actions (spec: jira-work-item-actions)

- [ ] 2.1 Switch `JiraClient` writes to `markdownToAdf` (create/update descriptions, comment bodies; Data Center passthrough unchanged) and add the `descriptionFormat` option to `getIssue` (markdown default, text alternative); verify with msw tests asserting structured ADF in Cloud request bodies and both read formats.
- [ ] 2.2 Update the action schemas: `description`/`body` input descriptions say Markdown, and `get-work-item` gains the `descriptionFormat` enum input (default markdown); verify with registry-mock tests covering the markdown-by-default and `descriptionFormat: text` scenarios plus a markdown create round-trip through the action.

## 3. Docs & verification

- [ ] 3.1 Update the plugin `README.md` rich-text notes (supported Markdown subset, per-product behavior, `descriptionFormat`) and the "plain-text description" wording in the affected template files; verify the template fixture tests and `yarn prettier --check` pass on changed paths.
- [ ] 3.2 Run the verification suite — `yarn tsc`, plugin lint and tests, `yarn build:backend` — and boot-smoke-test the backend; verify all pass.
