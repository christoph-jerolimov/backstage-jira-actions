export interface Config {
  /**
   * External service connections, following the Backstage connections
   * configuration convention (BEP-14). This plugin only reads entries with
   * `type: jira`; entries of other types are ignored here and owned by the
   * framework or other plugins.
   */
  connections?: Array<{
    /**
     * The connection type, e.g. `jira`.
     */
    type: string;
    /**
     * Optional human-readable display name for this connection.
     */
    title?: string;
    /**
     * The hostname of the service, e.g. `mycompany.atlassian.net`.
     */
    host?: string;
    /**
     * Base URL of the Jira REST API. Defaults to `https://<host>`.
     */
    apiBaseUrl?: string;
    /**
     * The Jira product variant, `cloud` (default) or `datacenter`.
     */
    product?: 'cloud' | 'datacenter';
    /**
     * Auth methods for this connection.
     */
    auth?: Array<{
      /**
       * The auth method, e.g. `basic` or `pat` for Jira connections.
       */
      method?: string;
      /**
       * Optional human-readable display name for this auth entry.
       */
      title?: string;
      /**
       * Username (the account email address for Jira Cloud) for `basic` auth.
       */
      username?: string;
      /**
       * API token for `basic` auth.
       * @visibility secret
       */
      apiToken?: string;
      /**
       * Personal access token for `pat` (bearer) auth.
       * @visibility secret
       */
      token?: string;
    }>;
  }>;
}
