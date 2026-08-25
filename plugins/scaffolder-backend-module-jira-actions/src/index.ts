/**
 * The scaffolder module that bridges software templates to the Jira actions
 * of the jira-actions plugin.
 *
 * @packageDocumentation
 */

export { scaffolderModuleJiraActions as default } from './module';
export { createInvokeJiraActionAction } from './actions/invokeJiraAction';
