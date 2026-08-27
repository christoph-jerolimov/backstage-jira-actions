import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import { assertPermission, jiraWorkItemReadPermission } from '../permissions';

export function registerListProjectsAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'list-projects',
    title: 'List Jira Projects',
    description:
      'Lists the Jira projects visible to the configured credentials, with their keys, names, IDs, descriptions and URLs. Optionally filters by a project name.',
    attributes: {
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    examples: [
      {
        title: 'Find projects by name',
        input: {
          name: 'platform',
        },
      },
    ],
    schema: {
      input: z =>
        z.object({
          name: z
            .string()
            .optional()
            .describe(
              'A case-insensitive filter matched against the project name or key',
            ),
          maxResults: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe('Maximum number of projects to return, default 50'),
          host: z
            .string()
            .optional()
            .describe(
              'The Jira host to target when multiple Jira connections are configured; defaults to the first configured connection',
            ),
        }),
      output: z =>
        z.object({
          projects: z
            .array(
              z.object({
                key: z.string().describe('The project key, e.g. "PROJ"'),
                name: z.string().describe('The project display name'),
                id: z.string().describe('The internal Jira project ID'),
                description: z
                  .string()
                  .optional()
                  .describe('The project description, if any'),
                url: z.string().describe('A browseable URL of the project'),
              }),
            )
            .describe('The visible Jira projects'),
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
      const projects = await client.listProjects({
        maxResults: input.maxResults ?? 50,
        name: input.name,
      });
      return { output: { projects } };
    },
  });
}
