# Proposal: Rate Limit Retries

## Why

Jira Cloud rate-limits with 429 responses, which the client currently surfaces as immediate errors — so an agent loop iterating over many issues fails at exactly the moment it is making progress. Honoring `Retry-After` with a small, bounded retry makes every action reliable under load without any caller-side logic.

## What Changes

- Every Jira API request (core and Agile) retries a 429 response up to two times, waiting per the `Retry-After` header (seconds or HTTP-date, capped at ten seconds per wait) or a short default backoff when the header is absent.
- A 429 that survives the retries fails with an error stating the rate limiting.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `jira-work-item-actions`: one ADDED requirement (rate limit handling).

## Impact

- `JiraClient.request` gains the retry loop and an injectable sleep (for tests); `throwForResponse` gains a 429-specific message. No action, template, or schema changes.
