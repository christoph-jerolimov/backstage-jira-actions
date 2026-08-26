import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import { assertPermission, jiraWorkItemReadPermission } from '../permissions';

export function registerSearchUsersAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'search-users',
    title: 'Search Jira Users',
    description:
      'Finds Jira users by name, email, or username, returning the identity value usable as an assignee or watcher input.',
    attributes: {
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    schema: {
      input: z =>
        z.object({
          query: z
            .string()
            .describe(
              'The search text, matched against display names, emails, and usernames',
            ),
          maxResults: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe('Maximum number of users to return, default 25'),
          host: z
            .string()
            .optional()
            .describe(
              'The Jira host to target when multiple Jira connections are configured; defaults to the first configured connection',
            ),
        }),
      output: z =>
        z.object({
          users: z
            .array(
              z.object({
                id: z
                  .string()
                  .describe(
                    'The assignable identity: the account ID on Jira Cloud, the username on Jira Data Center',
                  ),
                displayName: z.string().describe("The user's display name"),
                email: z
                  .string()
                  .optional()
                  .describe("The user's email address, when visible"),
                active: z.boolean().describe('Whether the user is active'),
              }),
            )
            .describe('The matching Jira users'),
        }),
    },
    action: async ({ input, credentials }) => {
      await assertPermission(
        permissions,
        jiraWorkItemReadPermission,
        credentials,
      );
      const connection = connections.find({ host: input.host });
      const client = new JiraClient(connection);
      const users = await client.searchUsers(input.query, {
        maxResults: input.maxResults ?? 25,
      });
      return { output: { users } };
    },
  });
}
