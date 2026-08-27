# jira-work-item-actions Delta

## ADDED Requirements

### Requirement: Discovery caching

The instance-level discovery data — issue link types and the field catalog — SHALL be cached per Jira connection for a short time-to-live of sixty seconds. Within the TTL, repeated `list-link-types` and `list-fields` invocations, and `link-work-items`' internal link-type resolution, SHALL be served from the cache without a Jira API call; after the TTL expires the next invocation SHALL fetch fresh data from Jira. The cache SHALL be scoped per connection host, and the `list-fields` name filter SHALL be applied to the cached data (the unfiltered catalog is what is cached).

#### Scenario: Repeated discovery reads within the TTL hit the cache

- **WHEN** `list-link-types` is invoked twice within sixty seconds on the same connection
- **THEN** Jira is called once and both invocations return the same link types

#### Scenario: Link resolution reuses the cache

- **WHEN** `list-link-types` has been invoked and `link-work-items` runs within the TTL
- **THEN** the link-type resolution does not call Jira's link type endpoint again

#### Scenario: The cache expires

- **WHEN** more than sixty seconds pass between two `list-fields` invocations
- **THEN** the second invocation fetches the field catalog from Jira again

#### Scenario: Different hosts are cached separately

- **WHEN** discovery reads target two different configured Jira hosts
- **THEN** each host's data is fetched and cached independently
