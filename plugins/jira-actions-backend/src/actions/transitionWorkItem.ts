import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { InputError } from '@backstage/errors';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import { assertPermission, jiraWorkItemWritePermission } from '../permissions';

export function registerTransitionWorkItemAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'transition-work-item',
    title: 'Transition Jira Work Item',
    description:
      'Moves a Jira work item (issue) to a target status by executing the matching workflow transition. Succeeds without changes when the issue already has the target status.',
    attributes: {
      readOnly: false,
      destructive: false,
      idempotent: true,
    },
    examples: [
      {
        title: 'Start work on an issue',
        input: {
          issueKey: 'PROJ-123',
          status: 'In Progress',
        },
      },
    ],
    schema: {
      input: z =>
        z.object({
          issueKey: z
            .string()
            .describe('The key of the issue to transition, e.g. "PROJ-123"'),
          status: z
            .string()
            .describe('The target status name, e.g. "In Progress"'),
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
          status: z.string().describe('The status of the issue after the call'),
          url: z.string().describe('A browseable URL of the issue'),
        }),
    },
    action: async ({ input, credentials, logger }) => {
      await assertPermission(
        permissions,
        jiraWorkItemWritePermission,
        credentials,
      );
      const connection = connections.find({ host: input.host });
      const client = new JiraClient(connection);
      const target = input.status.toLocaleLowerCase('en-US');

      const issue = await client.getIssue(input.issueKey);
      if (issue.status.toLocaleLowerCase('en-US') === target) {
        return {
          output: { key: issue.key, status: issue.status, url: issue.url },
        };
      }

      const transitions = await client.listTransitions(input.issueKey);
      const transition =
        transitions.find(
          t => t.toStatus?.toLocaleLowerCase('en-US') === target,
        ) ??
        transitions.find(t => t.name.toLocaleLowerCase('en-US') === target);
      if (!transition) {
        const reachable = transitions
          .map(t => t.toStatus ?? t.name)
          .filter(Boolean);
        throw new InputError(
          `Cannot transition ${input.issueKey} to status "${
            input.status
          }". Reachable statuses: ${reachable.join(', ') || 'none'}`,
        );
      }

      await client.transitionIssue(input.issueKey, transition.id);
      const status = transition.toStatus ?? input.status;
      logger.info(
        `Transitioned Jira issue ${input.issueKey} to "${status}" on ${connection.host}`,
      );
      return {
        output: {
          key: input.issueKey,
          status,
          url: client.browseUrl(input.issueKey),
        },
      };
    },
  });
}
