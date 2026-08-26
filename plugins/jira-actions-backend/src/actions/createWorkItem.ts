import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { InputError } from '@backstage/errors';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import { resolveEntityProject } from '../lib/entityProject';

export function registerCreateWorkItemAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  catalog: CatalogService;
}) {
  const { actionsRegistry, connections, catalog } = options;

  actionsRegistry.register({
    name: 'create-work-item',
    title: 'Create Jira Work Item',
    description:
      'Creates a new work item (issue) such as a Story, Bug or Task in a Jira project, and returns its key and URL. The project is identified by exactly one of "projectKey" and "entityRef".',
    attributes: {
      readOnly: false,
      destructive: false,
      idempotent: false,
    },
    schema: {
      input: z =>
        z.object({
          projectKey: z
            .string()
            .optional()
            .describe(
              'The key of the Jira project to create the issue in, e.g. "PROJ"; alternative to "entityRef"',
            ),
          entityRef: z
            .string()
            .optional()
            .describe(
              'A catalog entity ref, e.g. "component:default/my-service", whose "jira/project-key" annotation identifies the project; alternative to "projectKey"',
            ),
          issueType: z
            .string()
            .describe(
              'The name of the issue type, e.g. "Story", "Bug" or "Task"',
            ),
          summary: z.string().describe('The summary (title) of the issue'),
          description: z
            .union([z.string(), z.record(z.any())])
            .optional()
            .describe(
              'The issue description: a Markdown string by default, or per "descriptionFormat" an ADF document (object or JSON string) or literal plain text',
            ),
          descriptionFormat: z
            .enum(['markdown', 'adf', 'text'])
            .optional()
            .describe(
              'How to interpret "description": "markdown" (default, converted to ADF on Jira Cloud), "adf" (an ADF document, Jira Cloud only), or "text" (literal plain text)',
            ),
          labels: z
            .array(z.string())
            .optional()
            .describe('Labels to set on the issue'),
          assignee: z
            .string()
            .optional()
            .describe(
              'The assignee: a Jira account ID for Jira Cloud, or a username for Jira Data Center',
            ),
          parentKey: z
            .string()
            .optional()
            .describe(
              'The key of a parent issue, for sub-tasks or issues under an epic',
            ),
          host: z
            .string()
            .optional()
            .describe(
              'The Jira host to target when multiple Jira connections are configured; defaults to the entity\'s "jira/host" annotation or the first configured connection',
            ),
        }),
      output: z =>
        z.object({
          key: z
            .string()
            .describe('The key of the created issue, e.g. "PROJ-123"'),
          id: z.string().describe('The internal Jira ID of the created issue'),
          url: z.string().describe('A browseable URL of the created issue'),
        }),
    },
    action: async ({ input, credentials, logger }) => {
      if (
        (input.projectKey === undefined) ===
        (input.entityRef === undefined)
      ) {
        throw new InputError(
          'Provide exactly one of "projectKey" and "entityRef"',
        );
      }
      let projectKey = input.projectKey;
      let annotationHost: string | undefined;
      if (input.entityRef !== undefined) {
        const resolved = await resolveEntityProject({
          catalog,
          entityRef: input.entityRef,
          credentials,
        });
        projectKey = resolved.projectKey;
        annotationHost = resolved.host;
      }

      const connection = connections.find({
        host: input.host ?? annotationHost,
      });
      const client = new JiraClient(connection);
      const issue = await client.createIssue({
        ...input,
        projectKey: projectKey!,
      });
      logger.info(`Created Jira issue ${issue.key} on ${connection.host}`);
      return { output: issue };
    },
  });
}
