import { mockCredentials } from '@backstage/backend-test-utils';
import { catalogServiceMock } from '@backstage/plugin-catalog-node/testUtils';
import { resolveEntityProject } from './entityProject';

const credentials = mockCredentials.user();

function entity(name: string, annotations: Record<string, string>) {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name, namespace: 'default', annotations },
  };
}

describe('resolveEntityProject', () => {
  it('resolves the project key and host annotations', async () => {
    const catalog = catalogServiceMock({
      entities: [
        entity('my-service', {
          'jira/project-key': 'PROJ',
          'jira/host': 'jira.example.com',
        }),
      ],
    });

    await expect(
      resolveEntityProject({
        catalog,
        entityRef: 'component:default/my-service',
        credentials,
      }),
    ).resolves.toEqual({ projectKey: 'PROJ', host: 'jira.example.com' });
  });

  it('resolves without a host when only the project key is annotated', async () => {
    const catalog = catalogServiceMock({
      entities: [entity('my-service', { 'jira/project-key': 'PROJ' })],
    });

    await expect(
      resolveEntityProject({
        catalog,
        entityRef: 'component:default/my-service',
        credentials,
      }),
    ).resolves.toEqual({ projectKey: 'PROJ', host: undefined });
  });

  it('fails with NotFound for an unknown entity', async () => {
    const catalog = catalogServiceMock({ entities: [] });

    await expect(
      resolveEntityProject({
        catalog,
        entityRef: 'component:default/nope',
        credentials,
      }),
    ).rejects.toThrow(
      /Entity "component:default\/nope" was not found in the catalog/,
    );
  });

  it('fails with InputError when the annotation is missing', async () => {
    const catalog = catalogServiceMock({
      entities: [entity('my-service', { other: 'value' })],
    });

    await expect(
      resolveEntityProject({
        catalog,
        entityRef: 'component:default/my-service',
        credentials,
      }),
    ).rejects.toThrow(
      /Entity "component:default\/my-service" has no "jira\/project-key" annotation/,
    );
  });

  it('passes the caller credentials to the catalog lookup', async () => {
    const catalog = catalogServiceMock.mock({
      getEntityByRef: jest
        .fn()
        .mockResolvedValue(
          entity('my-service', { 'jira/project-key': 'PROJ' }),
        ),
    });

    await resolveEntityProject({
      catalog,
      entityRef: 'component:default/my-service',
      credentials,
    });

    expect(catalog.getEntityByRef).toHaveBeenCalledWith(
      'component:default/my-service',
      { credentials },
    );
  });
});
