import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import {
  assertPermission,
  jiraWorkItemReadPermission,
  jiraWorkItemWritePermission,
} from '../permissions';

export function registerListLinkTypesAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'list-link-types',
    title: 'List Jira Issue Link Types',
    description:
      'Lists the issue link types available on the Jira instance, with their inward and outward relation descriptions.',
    attributes: {
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    schema: {
      input: z =>
        z.object({
          host: z
            .string()
            .optional()
            .describe(
              'The Jira host to target when multiple Jira connections are configured; defaults to the first configured connection',
            ),
        }),
      output: z =>
        z.object({
          linkTypes: z
            .array(
              z.object({
                id: z.string().describe('The link type ID'),
                name: z.string().describe('The link type name, e.g. "Blocks"'),
                inward: z
                  .string()
                  .describe('The inward description, e.g. "is blocked by"'),
                outward: z
                  .string()
                  .describe('The outward description, e.g. "blocks"'),
              }),
            )
            .describe('The available issue link types'),
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
      const linkTypes = await client.listLinkTypes();
      return { output: { linkTypes } };
    },
  });
}

export function registerLinkWorkItemsAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'link-work-items',
    title: 'Link Jira Work Items',
    description:
      'Links two Jira work items (issues) with a relation such as "blocks", "relates to", or "duplicates". The link type may be given by name or by its inward/outward description; an inward description reverses the direction accordingly.',
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
            .describe('The key of the issue the relation reads from'),
          targetKey: z.string().describe('The key of the issue to link to'),
          linkType: z
            .string()
            .describe(
              'The link type name (e.g. "Blocks") or a relation description (e.g. "blocks", "is blocked by"), matched case-insensitively',
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
          targetKey: z.string().describe('The linked issue key'),
          linkType: z.string().describe('The resolved link type name'),
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
      const { linkType } = await client.linkIssues(
        input.issueKey,
        input.targetKey,
        input.linkType,
      );
      logger.info(
        `Linked Jira issues ${input.issueKey} and ${input.targetKey} (${linkType})`,
      );
      return {
        output: {
          key: input.issueKey,
          targetKey: input.targetKey,
          linkType,
          url: client.browseUrl(input.issueKey),
        },
      };
    },
  });
}
