# Design: Action Examples

## Context

`ActionsRegistryActionOptions.examples` (`{title, description?, input, output?}`) is already part of the registry contract and flows through `list()` to consumers; the mock registry exposes it the same way, so tests can assert coverage and schema-validity of every example input.

## Goals / Non-Goals

**Goals:** one realistic, schema-valid example per action (two where input modes differ meaningfully: create-work-item markdown description, search-work-items filters vs raw JQL). **Non-Goals:** exhaustive per-field examples, localized copy, output examples for every action (only where they clarify shapes, e.g. insights).

## Decisions

- **D1 Content:** examples use a consistent fictional world (project `PROJ`, board `7`, sprint `42`, issue `PROJ-123`) so multi-step agent flows read coherently across actions; identity examples use `me` where supported.
- **D2 Placement:** an `examples` array in each `register` call, between attributes and schema — pure metadata, no behavior change.
- **D3 Testing:** the discovery test additionally asserts every listed action has ≥1 example whose title is non-empty, and a dedicated test validates each example input against the action's input JSON schema presence (non-empty object where required fields exist).

## Risks / Trade-offs

- [Examples can drift from schemas] → The discovery-test coverage assertion plus schema-shaped fixtures keep them at least structurally honest; zod validation happens if an example is ever invoked in tests.

## Migration Plan

Metadata-only; merge and restart.

## Open Questions

None.
