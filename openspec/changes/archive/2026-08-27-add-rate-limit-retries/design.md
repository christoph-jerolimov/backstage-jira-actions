# Design: Rate Limit Retries

## Context

Jira Cloud enforces rate limits with 429 responses carrying `Retry-After` (delta-seconds or HTTP-date). Every plugin request funnels through the single `JiraClient.request` helper, so one retry loop covers all forty-one actions on both API roots.

## Goals / Non-Goals

**Goals:** transparent bounded retries for 429 on every request. **Non-Goals:** retrying 5xx/network errors, circuit breaking, client-side request budgeting, respecting the proactive `X-RateLimit-*` hints.

## Decisions

- **D1 Loop in `request`:** up to three attempts (two retries). On 429 with attempts left: wait `min(retryAfter, 10s)` where `retryAfter` parses delta-seconds or an HTTP-date, falling back to `1s × attempt` when absent/unparsable; then retry. Any other status returns immediately.
- **D2 Injectable sleep:** `new JiraClient(connection, { sleep? })` defaults to a real `setTimeout` wait; tests inject a recording no-op sleep to assert the waited durations (including the cap) without slow tests.
- **D3 Error:** `throwForResponse` maps 429 to an error stating Jira rate-limited the request (after retries), so agents can distinguish it from other failures.
- **D4 Testing:** msw handlers that 429 then succeed (asserting the recorded waits for delta-seconds, HTTP-date, cap, and absent-header cases), an exhaustion case asserting three attempts and the message, and a non-429 case asserting no retry.

## Risks / Trade-offs

- [Retries add worst-case latency (~20s)] → Bounded and only on 429; failing fast instead would just move the wait to the caller.

## Migration Plan

Behavior-only; merge and restart.

## Open Questions

None.
