import { createMockActionContext } from '@backstage/plugin-scaffolder-node-test-utils';
import { createInvokeJiraActionAction } from './invokeJiraAction';

function setup(invokeResult: unknown = { output: { key: 'PROJ-1' } }) {
  const actions = {
    list: jest.fn(),
    invoke: jest.fn().mockResolvedValue(invokeResult),
  };
  return { actions, action: createInvokeJiraActionAction({ actions }) };
}

describe('jira:action:invoke', () => {
  it('invokes the registry action with the given input and outputs the result', async () => {
    const { actions, action } = setup();
    const ctx = createMockActionContext({
      input: {
        actionId: 'jira-actions:get-work-item',
        input: { issueKey: 'PROJ-1' },
      },
    });

    await action.handler(ctx as any);

    expect(actions.invoke).toHaveBeenCalledWith({
      id: 'jira-actions:get-work-item',
      input: { issueKey: 'PROJ-1' },
      credentials: expect.anything(),
    });
    expect(ctx.output).toHaveBeenCalledWith('result', { key: 'PROJ-1' });
  });

  it('defaults the action input to an empty object', async () => {
    const { actions, action } = setup({ output: { projects: [] } });
    const ctx = createMockActionContext({
      input: { actionId: 'jira-actions:list-projects' },
    });

    await action.handler(ctx as any);

    expect(actions.invoke).toHaveBeenCalledWith(
      expect.objectContaining({ input: {} }),
    );
  });

  it('rejects action ids outside the jira-actions namespace before invoking', async () => {
    const { actions, action } = setup();
    const ctx = createMockActionContext({
      input: { actionId: 'catalog:delete-everything' },
    });

    await expect(action.handler(ctx as any)).rejects.toThrow(
      /Only actions of the jira-actions plugin can be invoked, got "catalog:delete-everything"/,
    );
    expect(actions.invoke).not.toHaveBeenCalled();
  });

  it('propagates registry action failures', async () => {
    const { actions, action } = setup();
    actions.invoke.mockRejectedValue(
      new Error('Failed to get Jira issue PROJ-999, status 404'),
    );
    const ctx = createMockActionContext({
      input: {
        actionId: 'jira-actions:get-work-item',
        input: { issueKey: 'PROJ-999' },
      },
    });

    await expect(action.handler(ctx as any)).rejects.toThrow(
      /Failed to get Jira issue PROJ-999, status 404/,
    );
    expect(ctx.output).not.toHaveBeenCalled();
  });
});
