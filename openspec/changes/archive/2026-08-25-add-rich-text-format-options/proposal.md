# Selectable Rich Text Formats: Markdown, ADF, or Plain Text

## Why

Descriptions and comments are currently always interpreted as Markdown. Callers that already have a real ADF document (e.g. copied from another issue or produced by an ADF-aware tool) cannot write it without it being mangled by Markdown parsing, and callers with literal plain text (that may contain characters Markdown would reinterpret, like `#` or `*`) cannot opt out of parsing. Reading has the inverse gap: `get-work-item` can render Markdown or text, but not hand back the raw ADF document.

## What Changes

Every rich-text input gains an explicit format selector, with `markdown` remaining the default:

- `add-comment` gains a `bodyFormat` input — enum `markdown` | `adf` | `text`, default `markdown` — controlling how `body` is interpreted.
- `create-work-item` and `update-work-item` gain a `descriptionFormat` input — same enum, default `markdown` — controlling how `description` is interpreted.
- `get-work-item`'s existing `descriptionFormat` input gains the `adf` option (returning the raw ADF document); `markdown` stays the default.

Format semantics on write (Jira Cloud):

- `markdown`: current behavior — the Markdown subset converts to ADF.
- `text`: the string is taken literally, line-per-paragraph, with no Markdown interpretation.
- `adf`: the input is an ADF document — passed either as a JSON object or as a JSON string (so string-only surfaces like the test templates can use it) — validated to be a `doc` and sent as-is.

On Jira Data Center, `markdown` and `text` pass the string through unchanged as today; requesting `adf` on a Data Center connection is rejected as invalid input (Data Center's API has no ADF). Reading on Data Center returns the stored string unchanged for all formats.

The `description`/`body` inputs (and the `description` output of `get-work-item`) become string-or-object to carry ADF documents; for `markdown`/`text` they remain plain strings.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-work-item-actions`: the rich text conversion requirement is generalized from Markdown-only to the three selectable formats, and the `create-work-item`, `update-work-item`, `add-comment`, and `get-work-item` requirements gain the format inputs.

## Impact

- **Modified code**: `plugins/jira-actions-backend` — `src/lib/adf.ts` (ADF input validation helper), `src/lib/JiraClient.ts` (format-aware field conversion, `adf` read format), the four action modules, README, tests. The four affected template files gain the format enum parameters.
- **Dependencies**: none added.
- **Behavior**: fully backward compatible — omitting the new inputs keeps today's Markdown behavior everywhere.
- **Security**: ADF input is structurally validated (must be a `doc` with a content array) but its node types are otherwise passed to Jira as-is, matching what any Jira API client can send with the same credentials.
