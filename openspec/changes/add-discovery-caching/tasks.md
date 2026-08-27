# Tasks: Discovery Caching

## 1. Implementation

- [ ] 1.1 Add `TtlCache` (`lib/cache.ts`, injectable clock), the optional cache in `JiraClient` for `listLinkTypes` and the raw field catalog behind `listFields`, and the `plugin.ts` wiring to the three registrations; verify with call-counting msw tests for cache hit, link-resolution reuse, expiry, and per-host separation; update the README and run the verification suite (tsc, lint, tests, prettier, build).
