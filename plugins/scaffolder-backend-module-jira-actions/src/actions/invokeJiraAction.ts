import { ActionsService } from '@backstage/backend-plugin-api/alpha';
import { InputError } from '@backstage/errors';
import { JsonObject } from '@backstage/types';
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';

/**
 * Creates the `jira:action:invoke` scaffolder action, which bridges template
 * steps to the Jira actions registered in the actions registry. Only actions
 * of the `jira-actions` plugin can be invoked.
 */
export function createInvokeJiraActionAction(options: {
  actions: ActionsService;
}) {
  const { actions } = options;

  return createTemplateAction({
    id: 'jira:action:invoke',
    description:
      'Invokes a Jira action from the actions registry (jira-actions plugin) and returns its output as the `result` step output.',
    schema: {
      input: {
        actionId: z =>
          z
            .string()
            .describe(
              'The registry action id to invoke, e.g. "jira-actions:create-work-item"',
            ),
        input: z =>
          z
            .record(z.any())
            .optional()
            .describe('The input passed to the registry action'),
      },
      output: {
        result: z => z.any().describe('The output of the invoked action'),
      },
    },
    async handler(ctx) {
      const { actionId, input } = ctx.input;
      if (!actionId.startsWith('jira-actions:')) {
        throw new InputError(
          `Only actions of the jira-actions plugin can be invoked, got "${actionId}"`,
        );
      }
      const credentials = await ctx.getInitiatorCredentials();
      const { output } = await actions.invoke({
        id: actionId,
        input: (input ?? {}) as JsonObject,
        credentials,
      });
      ctx.output('result', output);
    },
  });
}
