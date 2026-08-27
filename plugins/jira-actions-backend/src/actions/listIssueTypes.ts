import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { InputError } from '@backstage/errors';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import { resolveEntityProject } from '../lib/entityProject';
import { assertPermission, jiraWorkItemReadPermission } from '../permissions';

export function registerListIssueTypesAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
  catalog: CatalogService;
}) {
  const { actionsRegistry, connections, permissions, catalog } = options;

  actionsRegistry.register({
    name: 'list-issue-types',
    title: 'List Jira Issue Types',
    description:
      'Lists the issue types available in a given Jira project, e.g. Story, Bug, Task.',
    attributes: {
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    schema: {
      input: z =>
        z.object({
          projectKey: z
            .string()
            .optional()
            .describe(
              'The Jira project key to list issue types for; alternative to "entityRef"',
            ),
          entityRef: z
            .string()
            .optional()
            .describe(
              'A catalog entity ref, e.g. "component:default/my-service", whose "jira/project-key" annotation identifies the project; alternative to "projectKey"',
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
          issueTypes: z
            .array(
              z.object({
                id: z.string().describe('The internal Jira issue type ID'),
                name: z.string().describe('The issue type name, e.g. "Bug"'),
                subtask: z
                  .boolean()
                  .describe('Whether this is a sub-task issue type'),
                description: z
                  .string()
                  .optional()
                  .describe('The issue type description'),
              }),
            )
            .describe("The project's issue types"),
        }),
    },
    action: async ({ input, credentials }) => {
      await assertPermission(
        permissions,
        jiraWorkItemReadPermission,
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
      const issueTypes = await client.getProjectIssueTypes(projectKey!);
      return { output: { issueTypes } };
    },
  });
}
