# Tasks: Rate Limit Retries

## 1. Implementation

- [ ] 1.1 Add the 429 retry loop with `Retry-After` parsing (seconds and HTTP-date, 10s cap, default backoff), the injectable sleep, and the rate-limit error message; verify with msw tests for the retry-then-success, exhaustion, cap, absent-header, and no-retry-on-other-status cases; update the README and run the verification suite (tsc, lint, tests, prettier, build).
