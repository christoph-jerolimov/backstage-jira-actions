import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';

export function registerListProjectsAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
}) {
  const { actionsRegistry, connections } = options;

  actionsRegistry.register({
    name: 'list-projects',
    title: 'List Jira Projects',
    description:
      'Lists the Jira projects visible to the configured credentials, with their keys, names, and IDs.',
    attributes: {
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    schema: {
      input: z =>
        z.object({
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
              }),
            )
            .describe('The visible Jira projects'),
        }),
    },
    action: async ({ input }) => {
      const connection = connections.find({ host: input.host });
      const client = new JiraClient(connection);
      const projects = await client.listProjects({
        maxResults: input.maxResults ?? 50,
      });
      return { output: { projects } };
    },
  });
}
