import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import { resolveJiraUser } from '../lib/selfUser';
import { assertPermission, jiraWorkItemWritePermission } from '../permissions';

function registerWatcherAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
  catalog: CatalogService;
  mode: 'add' | 'remove';
}) {
  const { actionsRegistry, connections, permissions, catalog, mode } = options;

  actionsRegistry.register({
    name: `${mode}-watcher`,
    title:
      mode === 'add'
        ? 'Add Watcher to Jira Work Item'
        : 'Remove Watcher from Jira Work Item',
    description:
      mode === 'add'
        ? 'Adds a user as a watcher of a Jira work item (issue). Adding an existing watcher is a no-op.'
        : 'Removes a user from the watchers of a Jira work item (issue).',
    attributes: {
      readOnly: false,
      destructive: false,
      idempotent: true,
    },
    schema: {
      input: z =>
        z.object({
          issueKey: z
            .string()
            .describe('The key of the issue, e.g. "PROJ-123"'),
          user: z
            .string()
            .describe(
              'The user to add or remove: a Jira account ID on Jira Cloud, a username on Jira Data Center (as returned by search-users), or "me" for the invoking user',
            ),
          host: z
            .string()
            .optional()
            .describe(
              'The Jira host to target when multiple Jira connections are configured; defaults to the first configured connection',
            ),
        }),
      output: z =>
        z.object({
          key: z.string().describe('The issue key'),
          url: z.string().describe('A browseable URL of the issue'),
        }),
    },
    action: async ({ input, logger, credentials }) => {
      await assertPermission(
        permissions,
        jiraWorkItemWritePermission,
        credentials,
      );
      const connection = connections.find({ host: input.host });
      const client = new JiraClient(connection);
      const user = await resolveJiraUser({
        client,
        catalog,
        credentials,
        value: input.user,
      });
      if (mode === 'add') {
        await client.addWatcher(input.issueKey, user);
      } else {
        await client.removeWatcher(input.issueKey, user);
      }
      logger.info(
        `${mode === 'add' ? 'Added' : 'Removed'} watcher on Jira issue ${
          input.issueKey
        }`,
      );
      return {
        output: {
          key: input.issueKey,
          url: client.browseUrl(input.issueKey),
        },
      };
    },
  });
}

export function registerAddWatcherAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
  catalog: CatalogService;
}) {
  registerWatcherAction({ ...options, mode: 'add' });
}

export function registerRemoveWatcherAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
  catalog: CatalogService;
}) {
  registerWatcherAction({ ...options, mode: 'remove' });
}
