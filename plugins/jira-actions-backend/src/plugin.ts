import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { actionsRegistryServiceRef } from '@backstage/backend-plugin-api/alpha';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { registerAddCommentAction } from './actions/addComment';
import {
  registerCompleteSprintAction,
  registerCreateSprintAction,
  registerListBoardsAction,
  registerListSprintsAction,
  registerListSprintWorkItemsAction,
  registerMoveToBacklogAction,
  registerMoveToSprintAction,
  registerStartSprintAction,
  registerUpdateSprintAction,
} from './actions/agile';
import {
  registerDeleteCommentAction,
  registerUpdateCommentAction,
} from './actions/commentEditing';
import { registerCreateWorkItemAction } from './actions/createWorkItem';
import { registerDeleteWorkItemAction } from './actions/deleteWorkItem';
import { registerGetCommentsAction } from './actions/getComments';
import { registerGetWorkItemAction } from './actions/getWorkItem';
import {
  registerLinkWorkItemsAction,
  registerListLinkTypesAction,
} from './actions/issueLinks';
import {
  registerAddLabelAction,
  registerRemoveLabelAction,
} from './actions/labels';
import { registerListFieldsAction } from './actions/listFields';
import { registerListIssueTypesAction } from './actions/listIssueTypes';
import { registerListProjectsAction } from './actions/listProjects';
import { registerListTransitionsAction } from './actions/listTransitions';
import {
  registerAddRemoteLinkAction,
  registerGetRemoteLinksAction,
} from './actions/remoteLinks';
import { registerRenameWorkItemAction } from './actions/renameWorkItem';
import { registerSearchUsersAction } from './actions/searchUsers';
import { registerGetSprintInsightsAction } from './actions/sprintInsights';
import { registerSearchWorkItemsAction } from './actions/searchWorkItems';
import { registerSetWorkItemParentAction } from './actions/setWorkItemParent';
import { registerTransitionWorkItemAction } from './actions/transitionWorkItem';
import { registerUpdateWorkItemAction } from './actions/updateWorkItem';
import {
  registerCreateVersionAction,
  registerListComponentsAction,
  registerListVersionsAction,
} from './actions/versions';
import {
  registerAddWatcherAction,
  registerRemoveWatcherAction,
} from './actions/watchers';
import {
  registerAddWorklogAction,
  registerGetWorklogsAction,
} from './actions/worklogs';
import { JiraConnectionsReader } from './lib/connections';
import { jiraActionsPermissions } from './permissions';

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
        permissions: coreServices.permissions,
        permissionsRegistry: coreServices.permissionsRegistry,
      },
      async init({
        config,
        actionsRegistry,
        catalog,
        permissions,
        permissionsRegistry,
      }) {
        permissionsRegistry.addPermissions(jiraActionsPermissions);
        const connections = JiraConnectionsReader.fromConfig(config);
        const common = { actionsRegistry, connections, permissions };
        registerCreateWorkItemAction({ ...common, catalog });
        registerUpdateWorkItemAction({ ...common, catalog });
        registerRenameWorkItemAction(common);
        registerSetWorkItemParentAction(common);
        registerDeleteWorkItemAction(common);
        registerAddLabelAction(common);
        registerRemoveLabelAction(common);
        registerGetWorkItemAction(common);
        registerGetCommentsAction(common);
        registerSearchWorkItemsAction({ ...common, catalog });
        registerSearchUsersAction(common);
        registerAddCommentAction(common);
        registerUpdateCommentAction(common);
        registerDeleteCommentAction(common);
        registerAddRemoteLinkAction(common);
        registerGetRemoteLinksAction(common);
        registerLinkWorkItemsAction(common);
        registerListLinkTypesAction(common);
        registerListTransitionsAction(common);
        registerTransitionWorkItemAction(common);
        registerListProjectsAction(common);
        registerListIssueTypesAction({ ...common, catalog });
        registerListFieldsAction(common);
        registerListVersionsAction({ ...common, catalog });
        registerListComponentsAction({ ...common, catalog });
        registerCreateVersionAction({ ...common, catalog });
        registerGetWorklogsAction(common);
        registerAddWorklogAction(common);
        registerAddWatcherAction({ ...common, catalog });
        registerRemoveWatcherAction({ ...common, catalog });
        registerListBoardsAction(common);
        registerListSprintsAction(common);
        registerCreateSprintAction(common);
        registerUpdateSprintAction(common);
        registerStartSprintAction(common);
        registerCompleteSprintAction(common);
        registerListSprintWorkItemsAction(common);
        registerGetSprintInsightsAction(common);
        registerMoveToSprintAction(common);
        registerMoveToBacklogAction(common);
      },
    });
  },
});
