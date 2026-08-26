# Markdown Support for Descriptions and Comments

## Why

Descriptions and comments written through the Jira actions are currently plain text — every line becomes a bare ADF paragraph on Jira Cloud, so structure that AI agents naturally produce (headings, lists, code blocks, links) is flattened into unformatted prose. Supporting a Markdown subset in both directions makes agent-written tickets properly formatted in Jira, and lets agents read descriptions back with their structure intact.

## What Changes

- **Writing**: the `description` inputs of `create-work-item` and `update-work-item` and the `body` input of `add-comment` are interpreted as Markdown. On Jira Cloud a supported subset is converted to real ADF nodes — headings, paragraphs, bullet and ordered lists, fenced code blocks (with language), blockquotes, and inline bold/italic/code/links; anything outside the subset degrades gracefully to its plain-text content. On Jira Data Center the string is passed through unchanged, as today (Data Center uses wiki markup, not ADF).
- **Reading**: `get-work-item` gains a `descriptionFormat` input — `markdown` (new default) or `text`. On Cloud, `markdown` renders the ADF description back to the same Markdown subset (headings, lists, code blocks with language, links, bold/italic/code); `text` keeps today's plain-text rendering. On Data Center the stored string is returned as-is for both formats.
- Plain-text-only inputs remain valid Markdown, so existing callers keep working when writing; the reading default changes from plain text to Markdown (for text-only descriptions the two are identical).
- The plugin gains a `marked` dependency (zero-dependency Markdown tokenizer) for parsing; ADF generation and rendering stay hand-rolled in `src/lib/adf.ts`.
- README and template wording updated from "plain-text description" to Markdown.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-work-item-actions`: a new requirement defines the Markdown↔ADF conversion contract (supported subset, graceful degradation, per-product behavior), and the `create-work-item`, `update-work-item`, `add-comment`, and `get-work-item` requirements change from plain-text wording to Markdown (with the new `descriptionFormat` input on get).

## Impact

- **Modified code**: `plugins/jira-actions-backend` — `src/lib/adf.ts` (markdown→ADF and ADF→markdown converters alongside the existing text helpers), `src/lib/JiraClient.ts` (use the converters; format option on `getIssue`), the four action modules' schema descriptions, README, and tests. Minor wording updates in `examples/jira-actions-templates/`.
- **Dependencies**: `marked` added to the plugin (tokenizer only; no HTML rendering).
- **Behavior**: writing is backward compatible (plain text is valid Markdown and yields the same paragraphs); reading defaults to Markdown instead of plain text — identical output for unformatted descriptions, richer output for formatted ones, with `descriptionFormat: text` restoring the old behavior.
- **Security**: no new credential or network surface; Markdown is parsed, never rendered to HTML.
