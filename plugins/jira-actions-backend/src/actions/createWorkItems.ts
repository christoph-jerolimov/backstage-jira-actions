import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { InputError } from '@backstage/errors';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import { resolveEntityProject } from '../lib/entityProject';
import { resolveJiraUser } from '../lib/selfUser';
import { assertPermission, jiraWorkItemWritePermission } from '../permissions';

export function registerCreateWorkItemsAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
  catalog: CatalogService;
}) {
  const { actionsRegistry, connections, permissions, catalog } = options;

  const workItemFields = (z: any) => ({
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
        'How to interpret "description": "markdown" (default), "adf" (Jira Cloud only), or "text"',
      ),
    labels: z.array(z.string()).optional().describe('Labels to set'),
    assignee: z
      .string()
      .optional()
      .describe(
        'The assignee: a Jira account ID (Cloud), username (Data Center), or "me" for the invoking user',
      ),
    customFields: z
      .record(z.any())
      .optional()
      .describe(
        'Additional issue fields keyed by Jira field ID, passed to Jira verbatim',
      ),
  });

  actionsRegistry.register({
    name: 'create-work-items',
    title: 'Create Jira Work Items',
    description:
      'Creates up to fifty Jira work items (issues) in one call — optionally under a new epic created first, or under an existing parent. The pattern for breaking a feature into stories.',
    attributes: {
      readOnly: false,
      destructive: false,
      idempotent: false,
    },
    examples: [
      {
        title: 'Break a feature into stories under a new epic',
        input: {
          projectKey: 'PROJ',
          epic: {
            summary: 'Checkout revamp',
          },
          items: [
            {
              issueType: 'Story',
              summary: 'Redesign cart page',
            },
            {
              issueType: 'Story',
              summary: 'Add express checkout',
            },
          ],
        },
      },
    ],
    schema: {
      input: z =>
        z.object({
          projectKey: z
            .string()
            .optional()
            .describe(
              'The key of the Jira project to create the issues in, e.g. "PROJ"; alternative to "entityRef"',
            ),
          entityRef: z
            .string()
            .optional()
            .describe(
              'A catalog entity ref whose "jira/project-key" annotation identifies the project; alternative to "projectKey"',
            ),
          epic: z
            .object({
              summary: z.string().describe('The epic summary (title)'),
              issueType: z
                .string()
                .optional()
                .describe('The epic issue type name, default "Epic"'),
              ...workItemFields(z),
            })
            .optional()
            .describe(
              'A work item to create first and use as the parent of every item; cannot be combined with "parentKey"',
            ),
          parentKey: z
            .string()
            .optional()
            .describe(
              'An existing parent issue for every item; cannot be combined with "epic"',
            ),
          items: z
            .array(
              z.object({
                issueType: z
                  .string()
                  .describe('The issue type name, e.g. "Story"'),
                summary: z.string().describe('The issue summary (title)'),
                ...workItemFields(z),
              }),
            )
            .min(1)
            .max(50)
            .describe('The work items to create, at most fifty'),
          host: z
            .string()
            .optional()
            .describe(
              'The Jira host to target when multiple Jira connections are configured; defaults to the entity\'s "jira/host" annotation or the first configured connection',
            ),
        }),
      output: z =>
        z.object({
          parent: z
            .object({
              key: z.string().describe('The created epic key'),
              url: z.string().describe('A browseable URL of the epic'),
            })
            .optional()
            .describe('The created epic, when one was requested'),
          items: z
            .array(
              z.object({
                key: z.string(),
                id: z.string(),
                url: z.string(),
              }),
            )
            .describe('The created issues, in input order'),
        }),
    },
    action: async ({ input, logger, credentials }) => {
      await assertPermission(
        permissions,
        jiraWorkItemWritePermission,
        credentials,
      );
      if (
        (input.projectKey === undefined) ===
        (input.entityRef === undefined)
      ) {
        throw new InputError(
          'Provide exactly one of "projectKey" and "entityRef"',
        );
      }
      if (input.epic !== undefined && input.parentKey !== undefined) {
        throw new InputError('Provide either "epic" or "parentKey", not both');
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

      const resolvedUsers = new Map<string, string>();
      const resolveAssignee = async (value?: string) => {
        if (value === undefined) {
          return undefined;
        }
        if (!resolvedUsers.has(value)) {
          resolvedUsers.set(
            value,
            await resolveJiraUser({ client, catalog, credentials, value }),
          );
        }
        return resolvedUsers.get(value);
      };

      let parent: { key: string; url: string } | undefined;
      let parentKey = input.parentKey;
      if (input.epic !== undefined) {
        const epic = await client.createIssue({
          ...input.epic,
          issueType: input.epic.issueType ?? 'Epic',
          projectKey: projectKey!,
          assignee: await resolveAssignee(input.epic.assignee),
        });
        parent = { key: epic.key, url: epic.url };
        parentKey = epic.key;
      }

      const requests = [];
      for (const item of input.items) {
        requests.push({
          ...item,
          projectKey: projectKey!,
          parentKey,
          assignee: await resolveAssignee(item.assignee),
        });
      }
      const items = await client.createIssuesBulk(requests);
      logger.info(
        `Created ${items.length} Jira issue(s) in project ${projectKey}${
          parent ? ` under epic ${parent.key}` : ''
        }`,
      );
      return { output: { parent, items } };
    },
  });
}
