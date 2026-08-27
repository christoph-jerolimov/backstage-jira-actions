import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import {
  assertPermission,
  jiraWorkItemReadPermission,
  jiraWorkItemWritePermission,
} from '../permissions';

export function registerAddRemoteLinkAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'add-remote-link',
    title: 'Add Remote Link to Jira Work Item',
    description:
      'Attaches a titled web link to a Jira work item (issue), e.g. a pull request, a Backstage entity page, or a dashboard.',
    attributes: {
      readOnly: false,
      destructive: false,
      idempotent: false,
    },
    examples: [
      {
        title: 'Link a pull request',
        input: {
          issueKey: 'PROJ-123',
          url: 'https://github.com/acme/shop/pull/42',
          title: 'PR #42: Fix Safari login',
        },
      },
    ],
    schema: {
      input: z =>
        z.object({
          issueKey: z
            .string()
            .describe('The key of the issue, e.g. "PROJ-123"'),
          url: z.string().describe('The link target URL'),
          title: z.string().describe('The link text shown in Jira'),
          globalId: z
            .string()
            .optional()
            .describe(
              'A caller-chosen stable identifier; re-running with the same globalId updates the existing link instead of creating a duplicate',
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
          remoteLinkId: z
            .string()
            .describe('The ID of the created remote link'),
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
      const { remoteLinkId } = await client.addRemoteLink(input.issueKey, {
        url: input.url,
        title: input.title,
        globalId: input.globalId,
      });
      logger.info(
        `Added remote link "${input.title}" to Jira issue ${input.issueKey}`,
      );
      return {
        output: {
          key: input.issueKey,
          remoteLinkId,
          url: client.browseUrl(input.issueKey),
        },
      };
    },
  });
}

export function registerGetRemoteLinksAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'get-remote-links',
    title: 'Get Jira Work Item Remote Links',
    description: 'Reads the web links attached to a Jira work item (issue).',
    attributes: {
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    examples: [
      {
        title: 'Read the remote links',
        input: {
          issueKey: 'PROJ-123',
        },
      },
    ],
    schema: {
      input: z =>
        z.object({
          issueKey: z
            .string()
            .describe('The key of the issue, e.g. "PROJ-123"'),
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
          remoteLinks: z
            .array(
              z.object({
                id: z.string().describe('The remote link ID'),
                title: z.string().describe('The link title'),
                url: z.string().describe('The link target URL'),
                globalId: z
                  .string()
                  .optional()
                  .describe('The stable identifier, when the link has one'),
              }),
            )
            .describe("The issue's remote links"),
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
      const remoteLinks = await client.getRemoteLinks(input.issueKey);
      return {
        output: {
          key: input.issueKey,
          url: client.browseUrl(input.issueKey),
          remoteLinks,
        },
      };
    },
  });
}
