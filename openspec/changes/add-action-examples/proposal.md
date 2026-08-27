# Proposal: Action Examples

## Why

The actions registry supports per-action usage examples that flow to consumers (including MCP clients), but none of the forty-one actions declare any — so AI agents get schemas without a single concrete call to imitate. Examples are the cheapest way to improve tool-use accuracy.

## What Changes

- Every registered action declares at least one usage example (title + realistic input, output where illustrative); actions with notable input modes (e.g. markdown vs. raw JQL) get two.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-work-item-actions`: MODIFIED registration requirement (every action carries at least one example).

## Impact

- `examples` blocks in every action module; a discovery-test assertion that no action ships without one. No schema, template, or behavior changes.
