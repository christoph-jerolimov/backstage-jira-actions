import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { actionsRegistryServiceRef } from '@backstage/backend-plugin-api/alpha';
import { registerAddCommentAction } from './actions/addComment';
import { registerCreateWorkItemAction } from './actions/createWorkItem';
import { registerGetWorkItemAction } from './actions/getWorkItem';
import { registerListIssueTypesAction } from './actions/listIssueTypes';
import { registerListProjectsAction } from './actions/listProjects';
import { registerSearchWorkItemsAction } from './actions/searchWorkItems';
import { registerTransitionWorkItemAction } from './actions/transitionWorkItem';
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
        registerGetWorkItemAction({ actionsRegistry, connections });
        registerSearchWorkItemsAction({ actionsRegistry, connections });
        registerAddCommentAction({ actionsRegistry, connections });
        registerTransitionWorkItemAction({ actionsRegistry, connections });
        registerListProjectsAction({ actionsRegistry, connections });
        registerListIssueTypesAction({ actionsRegistry, connections });
      },
    });
  },
});
