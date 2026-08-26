import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { actionsRegistryServiceRef } from '@backstage/backend-plugin-api/alpha';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { registerAddCommentAction } from './actions/addComment';
import { registerCreateWorkItemAction } from './actions/createWorkItem';
import { registerGetCommentsAction } from './actions/getComments';
import { registerGetWorkItemAction } from './actions/getWorkItem';
import {
  registerAddLabelAction,
  registerRemoveLabelAction,
} from './actions/labels';
import { registerListIssueTypesAction } from './actions/listIssueTypes';
import { registerListProjectsAction } from './actions/listProjects';
import { registerRenameWorkItemAction } from './actions/renameWorkItem';
import { registerSearchWorkItemsAction } from './actions/searchWorkItems';
import { registerSetWorkItemParentAction } from './actions/setWorkItemParent';
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
        catalog: catalogServiceRef,
      },
      async init({ config, actionsRegistry, catalog }) {
        const connections = JiraConnectionsReader.fromConfig(config);
        registerCreateWorkItemAction({ actionsRegistry, connections, catalog });
        registerUpdateWorkItemAction({ actionsRegistry, connections });
        registerRenameWorkItemAction({ actionsRegistry, connections });
        registerSetWorkItemParentAction({ actionsRegistry, connections });
        registerAddLabelAction({ actionsRegistry, connections });
        registerRemoveLabelAction({ actionsRegistry, connections });
        registerGetWorkItemAction({ actionsRegistry, connections });
        registerGetCommentsAction({ actionsRegistry, connections });
        registerSearchWorkItemsAction({
          actionsRegistry,
          connections,
          catalog,
        });
        registerAddCommentAction({ actionsRegistry, connections });
        registerTransitionWorkItemAction({ actionsRegistry, connections });
        registerListProjectsAction({ actionsRegistry, connections });
        registerListIssueTypesAction({ actionsRegistry, connections, catalog });
      },
    });
  },
});
