# jira-work-item-actions Delta

## ADDED Requirements

### Requirement: Rate limit handling

Every Jira API request made by the actions SHALL handle HTTP 429 (rate limited) responses by retrying up to two times before failing. The wait before each retry SHALL honor the response's `Retry-After` header — given as seconds or as an HTTP-date — capped at ten seconds per wait, and SHALL fall back to a short backoff when the header is absent or unparsable. A request still rate-limited after the retries SHALL fail the action with an error stating that Jira rate-limited the request. Non-429 responses SHALL never be retried.

#### Scenario: A rate-limited request is retried and succeeds

- **WHEN** Jira responds 429 with a `Retry-After` header and the retried request succeeds
- **THEN** the action completes successfully after waiting the advertised time

#### Scenario: Retries are exhausted

- **WHEN** Jira responds 429 to the original request and to both retries
- **THEN** the action fails with an error stating that Jira rate-limited the request

#### Scenario: Excessive Retry-After is capped

- **WHEN** Jira responds 429 with a `Retry-After` far above ten seconds
- **THEN** the wait before the retry is capped at ten seconds
