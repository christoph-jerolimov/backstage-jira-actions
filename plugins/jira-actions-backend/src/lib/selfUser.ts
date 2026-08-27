import { BackstageCredentials } from '@backstage/backend-plugin-api';
import { InputError, NotFoundError } from '@backstage/errors';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { JiraClient } from './JiraClient';

/**
 * Resolves an identity input value: the reserved value "me"
 * (case-insensitive) becomes the invoking user's Jira identity, found via
 * their catalog profile email and Jira's user search; any other value is
 * returned unchanged.
 */
export async function resolveJiraUser(options: {
  client: JiraClient;
  catalog: CatalogService;
  credentials: BackstageCredentials;
  value: string;
}): Promise<string> {
  const { client, catalog, credentials, value } = options;
  if (value.toLocaleLowerCase('en-US') !== 'me') {
    return value;
  }

  const principal = credentials.principal as {
    type?: string;
    userEntityRef?: string;
  };
  if (principal.type !== 'user' || !principal.userEntityRef) {
    throw new InputError(
      'The value "me" requires a user caller; invoke the action as a user or pass an explicit Jira user id',
    );
  }

  const entity = await catalog.getEntityByRef(principal.userEntityRef, {
    credentials,
  });
  if (!entity) {
    throw new NotFoundError(
      `The catalog user entity ${principal.userEntityRef} was not found, so "me" cannot be resolved`,
    );
  }
  const email = (entity.spec?.profile as { email?: string } | undefined)?.email;
  if (!email) {
    throw new InputError(
      `The catalog user entity ${principal.userEntityRef} has no profile email, so "me" cannot be resolved`,
    );
  }

  const users = await client.searchUsers(email, { maxResults: 10 });
  const wanted = email.toLocaleLowerCase('en-US');
  const match =
    users.find(user => user.email?.toLocaleLowerCase('en-US') === wanted) ??
    (users.length === 1 ? users[0] : undefined);
  if (!match) {
    throw new NotFoundError(
      `No Jira user unambiguously matches the email ${email}, so "me" cannot be resolved; pass an explicit Jira user id`,
    );
  }
  return match.id;
}
