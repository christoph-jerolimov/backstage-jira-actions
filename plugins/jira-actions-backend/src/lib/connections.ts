import { RootConfigService } from '@backstage/backend-plugin-api';
import { InputError, NotFoundError } from '@backstage/errors';
import { z } from 'zod';

/**
 * The auth methods supported for `type: jira` connections.
 */
export type JiraAuthMethod = 'basic' | 'pat';

const jiraAuthSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('basic'),
    title: z.string().optional(),
    username: z.string().min(1),
    apiToken: z.string().min(1),
  }),
  z.object({
    method: z.literal('pat'),
    title: z.string().optional(),
    token: z.string().min(1),
  }),
]);

const jiraConnectionSchema = z.object({
  type: z.literal('jira'),
  title: z.string().optional(),
  host: z.string().min(1),
  apiBaseUrl: z.string().url().optional(),
  product: z.enum(['cloud', 'datacenter']).default('cloud'),
  auth: z
    .array(jiraAuthSchema)
    .min(1, 'must configure at least one auth method'),
});

export type JiraConnectionAuth = z.infer<typeof jiraAuthSchema>;

/**
 * A resolved Jira connection, with defaults applied. The `auth` array is
 * non-empty and ordered by preference; consumers use the first entry.
 */
export type JiraConnection = {
  type: 'jira';
  title: string;
  host: string;
  apiBaseUrl: string;
  product: 'cloud' | 'datacenter';
  auth: JiraConnectionAuth[];
};

/**
 * Reads `type: jira` entries from the top-level `connections` configuration
 * section, mirroring the lookup contract of the Backstage connections
 * framework (`@backstage/connections`) so that it can be replaced by the
 * framework's ConnectionsService once a jira connection type exists there.
 */
export class JiraConnectionsReader {
  private constructor(private readonly connections: JiraConnection[]) {}

  static fromConfig(config: RootConfigService): JiraConnectionsReader {
    const raw = config.getOptional('connections');
    if (raw === undefined) {
      return new JiraConnectionsReader([]);
    }
    if (!Array.isArray(raw)) {
      throw new InputError(
        'Expected "connections" config to be an array of connection objects',
      );
    }

    const connections = new Array<JiraConnection>();
    raw.forEach((entry, index) => {
      // Entries of other connection types are owned by the framework or
      // other plugins, and are not validated here.
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        return;
      }
      if ((entry as { type?: unknown }).type !== 'jira') {
        return;
      }
      const result = jiraConnectionSchema.safeParse(entry);
      if (!result.success) {
        const identity =
          typeof (entry as { host?: unknown }).host === 'string'
            ? `host "${(entry as { host: string }).host}"`
            : `index ${index}`;
        throw new InputError(
          `Invalid connection of type "jira" (${identity}) in connections config: ${result.error.issues
            .map(
              issue =>
                `${issue.path.join('.') || 'connection'}: ${issue.message}`,
            )
            .join('; ')}`,
        );
      }
      const { title, host, apiBaseUrl, product, auth } = result.data;
      connections.push({
        type: 'jira',
        title: title ?? `Jira (${host})`,
        host,
        apiBaseUrl: apiBaseUrl ?? `https://${host}`,
        product,
        auth,
      });
    });

    return new JiraConnectionsReader(connections);
  }

  /**
   * Finds a configured Jira connection. Without a `host` query the first
   * configured Jira connection is returned. When `authMethods` is given, the
   * returned connection's auth entries are narrowed to those methods, and
   * connections without any acceptable auth entry are skipped.
   */
  find(options?: {
    host?: string;
    authMethods?: JiraAuthMethod[];
  }): JiraConnection {
    const { host, authMethods } = options ?? {};

    if (this.connections.length === 0) {
      throw new NotFoundError(
        'No Jira connection is configured. Add an entry with type "jira" to the "connections" section of your app-config.',
      );
    }

    for (const connection of this.connections) {
      if (host !== undefined && connection.host !== host) {
        continue;
      }
      const auth = authMethods
        ? connection.auth.filter(entry => authMethods.includes(entry.method))
        : connection.auth;
      if (auth.length === 0) {
        continue;
      }
      return { ...connection, auth };
    }

    const criteria = [
      ...(host !== undefined ? [`host "${host}"`] : []),
      ...(authMethods ? [`auth methods [${authMethods.join(', ')}]`] : []),
    ].join(' and ');
    throw new NotFoundError(
      `No Jira connection matches ${
        criteria || 'the given query'
      }. Check the "connections" section of your app-config.`,
    );
  }
}
