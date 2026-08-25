import { createBackendModule } from '@backstage/backend-plugin-api';
import { actionsServiceRef } from '@backstage/backend-plugin-api/alpha';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node';
import { createInvokeJiraActionAction } from './actions/invokeJiraAction';

/**
 * A scaffolder module that adds the `jira:action:invoke` action, bridging
 * software templates to the Jira actions in the actions registry.
 *
 * @public
 */
export const scaffolderModuleJiraActions = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'jira-actions',
  register(env) {
    env.registerInit({
      deps: {
        scaffolderActions: scaffolderActionsExtensionPoint,
        actions: actionsServiceRef,
      },
      async init({ scaffolderActions, actions }) {
        scaffolderActions.addActions(createInvokeJiraActionAction({ actions }));
      },
    });
  },
});
