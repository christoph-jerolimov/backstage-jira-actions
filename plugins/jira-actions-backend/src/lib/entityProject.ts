import { BackstageCredentials } from '@backstage/backend-plugin-api';
import { InputError, NotFoundError } from '@backstage/errors';
import { CatalogService } from '@backstage/plugin-catalog-node';

/**
 * The catalog entity annotation carrying the Jira project key of the entity.
 */
export const PROJECT_KEY_ANNOTATION = 'jira/project-key';

/**
 * The optional catalog entity annotation carrying the Jira host to use for
 * the entity, for setups with multiple Jira connections.
 */
export const HOST_ANNOTATION = 'jira/host';

/**
 * Resolves the Jira project of a catalog entity from its annotations. The
 * entity is looked up with the invoking caller's credentials, so catalog
 * visibility rules apply.
 */
export async function resolveEntityProject(options: {
  catalog: CatalogService;
  entityRef: string;
  credentials: BackstageCredentials;
}): Promise<{ projectKey: string; host?: string }> {
  const { catalog, entityRef, credentials } = options;

  const entity = await catalog.getEntityByRef(entityRef, { credentials });
  if (!entity) {
    throw new NotFoundError(
      `Entity "${entityRef}" was not found in the catalog`,
    );
  }

  const annotations = entity.metadata.annotations ?? {};
  const projectKey = annotations[PROJECT_KEY_ANNOTATION];
  if (!projectKey) {
    throw new InputError(
      `Entity "${entityRef}" has no "${PROJECT_KEY_ANNOTATION}" annotation`,
    );
  }

  return { projectKey, host: annotations[HOST_ANNOTATION] || undefined };
}
