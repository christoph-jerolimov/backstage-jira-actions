# Proposal: Discovery Caching

## Why

Agents call the instance-level discovery reads — link types and fields — over and over (every `link-work-items` call re-fetches the link types), yet these change essentially never within a session. A short-TTL cache removes redundant Jira round-trips and rate-limit pressure without staleness risk worth caring about.

## What Changes

- Link types and the field catalog are cached per Jira connection for sixty seconds: repeated reads within the TTL (including `link-work-items`' internal type resolution) are served from the cache; expiry refetches.
- No schema, action, or template changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-work-item-actions`: one ADDED requirement (discovery caching).

## Impact

- New `lib/cache.ts` (`TtlCache` with an injectable clock); `JiraClient` accepts an optional cache used by `listLinkTypes`/`listFields`; `plugin.ts` creates one backend-lifetime cache and passes it to the `list-fields`, `list-link-types`, and `link-work-items` registrations; README note.
