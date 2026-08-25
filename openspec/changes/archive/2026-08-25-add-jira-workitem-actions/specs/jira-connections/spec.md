## Purpose

Resolves Jira connection configuration — host, API base URL, product variant, and credentials — from the Backstage `connections` configuration section so that backend plugins can call the Jira REST API without embedding connection details in their own config.

## ADDED Requirements

### Requirement: Jira connections are declared in the `connections` configuration section

The system SHALL read Jira connections from the top-level `connections` array in the Backstage configuration, following the Backstage connections convention: each entry is an object with a `type` field, an optional `title`, connection-type-specific fields, and an `auth` array of auth method entries. Entries with `type: jira` SHALL be recognized as Jira connections; entries of any other type SHALL be ignored by this capability.

A Jira connection entry SHALL support the following fields:

- `host` (required): the Jira hostname, e.g. `mycompany.atlassian.net`.
- `apiBaseUrl` (optional): the Jira REST API base URL; defaults to `https://<host>`.
- `product` (optional): `cloud` or `datacenter`; defaults to `cloud`. Determines the default REST API version used (v3 for `cloud`, v2 for `datacenter`).
- `title` (optional): a human-readable display name; defaults to a name derived from the connection type and host.
- `auth` (required): a non-empty array of auth method entries.

#### Scenario: A valid Jira connection is configured

- **WHEN** the configuration contains a `connections` entry with `type: jira`, a `host`, and at least one supported auth entry
- **THEN** the connection is resolved and made available to consumers, with `apiBaseUrl` defaulting to `https://<host>` and `product` defaulting to `cloud` when omitted

#### Scenario: Non-Jira connection entries are present

- **WHEN** the `connections` array contains entries whose `type` is not `jira` (e.g. `github`)
- **THEN** those entries are ignored without error and do not affect Jira connection resolution

#### Scenario: Invalid Jira connection entry

- **WHEN** a `connections` entry with `type: jira` is missing `host`, has an empty `auth` array, or contains an auth entry with an unknown `method`
- **THEN** the system fails at startup with an error that names the invalid connection and the reason, rather than silently skipping it

### Requirement: Jira connections support basic and personal access token authentication

The system SHALL support the following auth methods for Jira connections:

- `basic`: fields `username` (email address for Jira Cloud) and `apiToken`; requests authenticate with HTTP Basic auth.
- `pat`: field `token`; requests authenticate with an HTTP `Authorization: Bearer` header (Jira Data Center/Server personal access tokens).

Credential values SHALL never be included in action inputs, action outputs, log messages, or error messages.

#### Scenario: Basic auth entry

- **WHEN** a Jira connection declares an auth entry `method: basic` with `username` and `apiToken`
- **THEN** API requests made using that connection carry an HTTP Basic Authorization header derived from those values

#### Scenario: Personal access token entry

- **WHEN** a Jira connection declares an auth entry `method: pat` with `token`
- **THEN** API requests made using that connection carry an `Authorization: Bearer <token>` header

#### Scenario: Credentials are not leaked

- **WHEN** any error is raised or any log line is written while resolving connections or calling Jira
- **THEN** the message contains no credential material (no tokens, passwords, or Authorization header values)

### Requirement: Connection lookup follows the Backstage connections service contract

The system SHALL expose Jira connection lookup to in-process consumers through a `find`-style operation that accepts a connection type, an optional query (by `host`), and a list of acceptable auth methods, mirroring the `ConnectionsService` contract of `@backstage/connections`. When multiple Jira connections are configured, a lookup without a query SHALL return the first configured Jira connection; a lookup with a `host` query SHALL return the connection matching that host.

#### Scenario: Lookup with no query returns the default connection

- **WHEN** two Jira connections are configured and a consumer looks up a Jira connection without a host query
- **THEN** the first configured Jira connection is returned

#### Scenario: Lookup by host

- **WHEN** two Jira connections with different hosts are configured and a consumer queries for one of the hosts
- **THEN** the connection with the matching host is returned

#### Scenario: No matching connection

- **WHEN** no Jira connection is configured, or none matches the requested host or acceptable auth methods
- **THEN** the lookup fails with a NotFound-style error explaining that no matching Jira connection is configured
