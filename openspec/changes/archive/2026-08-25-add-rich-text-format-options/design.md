# Design: Selectable Rich Text Formats

## Context

See proposal.md for motivation. Current state after `add-markdown-adf-support`: `src/lib/adf.ts` has `textToAdf`, `markdownToAdf`, `adfToText`, `adfToMarkdown`; `JiraClient.toOptionalFields` and `addComment` hardcode `markdownToAdf` on Cloud, `getIssue` takes `descriptionFormat: 'markdown' | 'text'`. Registry input schemas must stay plain zod objects; the actions-registry JSON schemas support unions.

## Goals / Non-Goals

**Goals:**

- One shared format vocabulary (`markdown` | `adf` | `text`) and one shared conversion function used by all writing actions, so the three actions cannot drift.
- ADF accepted as an object or a JSON string, so string-only surfaces (template forms, simple MCP clients) can still send it.
- Backward compatible defaults: omit the format inputs and nothing changes.

**Non-Goals:**

- No ADF schema validation beyond the structural `doc` check — Jira remains the authority on ADF validity and returns 400s for bad documents.
- No `adf` write support for Data Center (rejected as invalid input), and no wiki-markup conversion.
- No format selector on `search-work-items` (it returns no descriptions).

## Decisions

### D1: A single `toAdfField(value, format, product)` conversion seam

A new helper in `src/lib/adf.ts`:

```ts
type RichTextFormat = 'markdown' | 'adf' | 'text';
toWriteValue(value: string | JsonObject, format: RichTextFormat, isCloud: boolean): string | JsonObject
```

- `markdown`/`text` + string: Cloud → `markdownToAdf` / `textToAdf`; Data Center → passthrough. A non-string value with these formats → `InputError`.
- `adf`: object used as-is; string `JSON.parse`d (unparsable → `InputError` naming the problem); the result must be `{type: 'doc'}` with a `content` array (`parseAdfInput` helper) → else `InputError`. On Data Center → `InputError` ("format \"adf\" requires a Jira Cloud connection").

`JiraClient` calls this from `toOptionalFields` (description + new `descriptionFormat` on `JiraWorkItemFields`) and `addComment(issueKey, body, bodyFormat)`. The Data Center check needs the product, which the client has — so the error surfaces after connection resolution, before any HTTP request, satisfying the spec's "before any Jira call".

### D2: Input/output types widen to `string | object` only where ADF flows

The zod inputs for `description`/`body` become `z.union([z.string(), z.record(z.any())])` with descriptions explaining the union ("a string; or an ADF document (object or JSON string) when the format is adf"). The format selectors are separate enum inputs (`descriptionFormat` on create/update/get, `bodyFormat` on add-comment), defaulting to `markdown` in the handlers — matching the user-visible contract that the option is a second field. `get-work-item`'s output `description` becomes the same union; `JiraWorkItem.description` becomes `string | JsonObject | undefined`, and `getIssue`'s `adf` format returns `fields.description` as-is when it is an object (strings — Data Center — pass through unchanged).

Update-work-item's "at least one updatable field" rule counts only the existing updatable fields; a lone `descriptionFormat` without `description` does not count (it is a modifier, not a change).

### D3: Templates expose the format enums as string parameters

`add-comment` gains a `bodyFormat` enum parameter, `create-work-item`/`update-work-item` gain `descriptionFormat` enum parameters, and `get-work-item`'s existing `descriptionFormat` parameter gains `adf` — all with `markdown` listed first as the default. Template `description`/`body` parameters stay strings; the JSON-string ADF path exists precisely so these forms can submit ADF.

### D4: Testing

- Unit tests for the conversion seam: each format on Cloud, passthrough and the `adf` rejection on Data Center, JSON-string parsing, structural validation failures, non-string input with `markdown`/`text`.
- Client tests: literal `text` writes (Markdown-significant characters stay literal), `adf` object and JSON-string writes sent verbatim, `getIssue` returning raw ADF.
- Action tests: each new input on its action, the Data Center `adf` rejection, `update-work-item` with only `descriptionFormat` still rejected, and the get default staying `markdown`.
- Template fixture test: the format parameters exist with the right enum values on the four affected templates.

## Risks / Trade-offs

- [Union input types make the generated JSON schema looser for `description`/`body`] → Accepted; the format field and input descriptions carry the contract, and invalid combinations fail fast with precise `InputError`s.
- [A JSON-string ADF input could be intended as literal text] → Only interpreted when the caller explicitly selects `adf`; the default never parses.
- [Raw ADF passthrough lets callers send node types the plugin doesn't understand] → Same authority model as any Jira client; Jira validates and its 400 details are already surfaced.

## Migration Plan

Backward compatible: merge and restart; existing invocations behave identically. Rollback = revert the commit.

## Open Questions

None.
