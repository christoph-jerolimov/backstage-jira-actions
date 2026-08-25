# Design: Markdown ↔ ADF Support

## Context

See proposal.md for motivation. Current state: `src/lib/adf.ts` holds `textToAdf` (line → paragraph) and `adfToText` (recursive text extraction); `JiraClient` applies them for Cloud descriptions (`toOptionalFields`, `getIssue`) and comment bodies, passing plain strings through on Data Center. The ADF format is a JSON tree of block nodes (`heading` with `attrs.level`, `paragraph`, `bulletList`/`orderedList` of `listItem`s, `codeBlock` with `attrs.language`, `blockquote`) whose inline `text` nodes carry `marks` (`strong`, `em`, `code`, `link` with `attrs.href`).

## Goals / Non-Goals

**Goals:**

- Bidirectional Markdown↔ADF conversion for the documented subset, tolerant by construction: nothing a caller writes or Jira returns may make a conversion throw.
- Round-trip stability for content inside the subset (markdown → ADF → markdown yields equivalent Markdown).
- No behavior change for Data Center or for plain-text content.

**Non-Goals:**

- Tables, images/media, mentions, task lists, nested lists deeper than one level, and Jira wiki markup conversion for Data Center are out of scope (unsupported constructs degrade to text, they are not errors).
- No HTML: Markdown is tokenized, never rendered; raw HTML in Markdown input is treated as literal text.

## Decisions

### D1: `marked` lexer for parsing, hand-rolled ADF mapping

Markdown parsing uses the `marked` package's **lexer only** (`marked.lexer()` → token tree; zero dependencies, no HTML involved). A new `markdownToAdf` in `src/lib/adf.ts` maps block tokens (`heading`, `paragraph`, `list`, `code`, `blockquote`, `space`) to ADF nodes and inline tokens (`strong`, `em`, `codespan`, `link`, `br`, `text`) to marked text nodes. Unknown token types fall back to their raw text content in a paragraph. `textToAdf` remains as the internal fallback and for tests, but the client switches to `markdownToAdf` (which reproduces `textToAdf`'s output for plain lines — single newlines inside a paragraph become `hardBreak`s).

_Alternative considered_: hand-rolled regex parser — rejected: inline parsing (nested emphasis, links with titles, escaping) is exactly where regex parsers go wrong; `marked` is a well-exercised tokenizer with no transitive dependencies. Also considered remark/mdast — rejected as a heavier dependency tree for the same tokens.

### D2: Hand-rolled `adfToMarkdown` mirror

`adfToMarkdown` walks the ADF tree emitting the subset: `heading[level]` → `#`·level, `codeBlock` → fenced block with `attrs.language`, `bulletList`/`orderedList` → `- ` / `1. ` items (one nesting level via indentation), `blockquote` → `> ` prefixes, `paragraph` → blank-line-separated text, `hardBreak` → line break. Marks render as `**bold**`, `*italic*`, `` `code` ``, `[text](href)` (mark order: link outermost). Nodes outside the subset reuse the `adfToText` extraction for their content — same graceful degradation contract as today. `adfToText` stays unchanged for `descriptionFormat: text`.

### D3: Format plumbed through `getIssue`, defaulting to Markdown

`JiraClient.getIssue(issueKey, options?: { descriptionFormat?: 'markdown' | 'text' })` picks `adfToMarkdown` or `adfToText` for Cloud descriptions (strings pass through either way, covering Data Center). The `get-work-item` input schema gains `descriptionFormat` as a zod enum defaulting to `markdown`. Defaulting to Markdown is a deliberate behavior change: for unformatted descriptions the two renderings are identical, and for formatted ones Markdown is strictly more useful to the MCP/AI consumers this plugin targets; `text` remains one input away. `transition-work-item`'s internal `getIssue` call is unaffected (it only reads `status`).

### D4: Round-trip and fixture testing

- `markdownToAdf` unit tests per construct (heading levels, both list kinds, fenced code with/without language, blockquote, inline marks, links, hard breaks, plain text equivalence with the old paragraph shape, unknown constructs).
- `adfToMarkdown` unit tests per node type plus degradation cases (table/mention-like nodes).
- Round-trip property: for each supported-subset fixture, `adfToMarkdown(markdownToAdf(md))` equals the normalized fixture.
- Client tests updated: Cloud create/comment requests now carry structured ADF for Markdown input; `getIssue` asserted in both formats. Action tests updated for the `descriptionFormat` input and new default.

## Risks / Trade-offs

- [Changing the get default from text to Markdown alters existing consumers' output for formatted descriptions] → Accepted and spec'd; unformatted descriptions are unaffected, and `descriptionFormat: text` restores the old rendering exactly.
- [Markdown emitted by `adfToMarkdown` may not byte-match the input (e.g. `_em_` in → `*em*` out)] → Round-trip guarantees equivalence, not byte identity; tests compare normalized forms.
- [`marked` tokenizes full CommonMark, more than the subset (tables, html, images)] → The mapper only handles subset tokens and routes everything else through the text fallback, so extra tokenizer capabilities cannot produce invalid ADF.
- [ADF written by other Jira clients can contain arbitrary node types] → `adfToMarkdown` shares the total, throw-free traversal style of `adfToText`; degradation tests pin this.

## Migration Plan

Additive dependency and converter changes within one package: merge, `yarn install`, restart backend. Callers needing the previous reading behavior pass `descriptionFormat: text`. Rollback = revert the commit.

## Open Questions

None.
