import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { actionsRegistryServiceRef } from '@backstage/backend-plugin-api/alpha';
import { registerCreateWorkItemAction } from './actions/createWorkItem';
import { registerUpdateWorkItemAction } from './actions/updateWorkItem';
import { JiraConnectionsReader } from './lib/connections';

/**
 * A backend plugin that registers Jira work item actions in the actions
 * registry, using Jira connections from the `connections` configuration.
 *
 * @public
 */
export const jiraActionsPlugin = createBackendPlugin({
  pluginId: 'jira-actions',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        actionsRegistry: actionsRegistryServiceRef,
      },
      async init({ config, actionsRegistry }) {
        const connections = JiraConnectionsReader.fromConfig(config);
        registerCreateWorkItemAction({ actionsRegistry, connections });
        registerUpdateWorkItemAction({ actionsRegistry, connections });
      },
    });
  },
});
