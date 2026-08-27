import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { JiraClient } from '../lib/JiraClient';
import { JiraConnectionsReader } from '../lib/connections';
import { assertPermission, jiraWorkItemReadPermission } from '../permissions';

export function registerListFieldsAction(options: {
  actionsRegistry: ActionsRegistryService;
  connections: JiraConnectionsReader;
  permissions: PermissionsService;
}) {
  const { actionsRegistry, connections, permissions } = options;

  actionsRegistry.register({
    name: 'list-fields',
    title: 'List Jira Fields',
    description:
      'Lists the fields defined on the Jira instance, including custom fields, so that custom field IDs can be discovered for the customFields inputs.',
    attributes: {
      readOnly: true,
      destructive: false,
      idempotent: true,
    },
    schema: {
      input: z =>
        z.object({
          name: z
            .string()
            .optional()
            .describe(
              'A case-insensitive filter matched against field names and IDs',
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
          fields: z
            .array(
              z.object({
                id: z
                  .string()
                  .describe('The field ID, e.g. "customfield_10020"'),
                name: z.string().describe('The field display name'),
                custom: z
                  .boolean()
                  .describe('Whether the field is a custom field'),
                type: z
                  .string()
                  .optional()
                  .describe('The field value type, when known'),
              }),
            )
            .describe('The fields defined on the instance'),
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
      const fields = await client.listFields({ name: input.name });
      return { output: { fields } };
    },
  });
}
