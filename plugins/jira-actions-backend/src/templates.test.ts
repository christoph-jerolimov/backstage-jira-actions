import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';

const TEMPLATES_DIR = resolve(
  __dirname,
  '../../../examples/jira-actions-templates',
);

// The required inputs of each registry action, which every test template
// must ask for as required parameters.
const REQUIRED_INPUTS: Record<string, string[]> = {
  'create-work-item': ['issueType', 'summary'],
  'update-work-item': ['issueKey'],
  'rename-work-item': ['issueKey', 'summary'],
  'set-work-item-parent': ['issueKey', 'parentKey'],
  'delete-work-item': ['issueKey'],
  'get-work-item': ['issueKey'],
  'search-work-items': [],
  'search-users': ['query'],
  'add-comment': ['issueKey', 'body'],
  'get-comments': ['issueKey'],
  'update-comment': ['issueKey', 'commentId', 'body'],
  'delete-comment': ['issueKey', 'commentId'],
  'add-label': ['issueKey', 'label'],
  'remove-label': ['issueKey', 'label'],
  'add-remote-link': ['issueKey', 'url', 'title'],
  'get-remote-links': ['issueKey'],
  'link-work-items': ['issueKey', 'targetKey', 'linkType'],
  'list-link-types': [],
  'list-transitions': ['issueKey'],
  'transition-work-item': ['issueKey', 'status'],
  'list-projects': [],
  'list-issue-types': [],
  'list-fields': [],
  'list-versions': [],
  'list-components': [],
  'create-version': ['name'],
  'get-worklogs': ['issueKey'],
  'add-worklog': ['issueKey', 'timeSpent'],
  'add-watcher': ['issueKey', 'user'],
  'remove-watcher': ['issueKey', 'user'],
  'list-boards': [],
  'list-sprints': ['boardId'],
  'move-to-sprint': ['sprintId', 'issueKeys'],
};

// Actions that accept a catalog entity ref as an alternative to a project
// key; their templates must offer an entity picker for it.
const ENTITY_REF_ACTIONS = [
  'create-work-item',
  'search-work-items',
  'list-issue-types',
  'list-versions',
  'list-components',
  'create-version',
];

// Actions whose templates carry a rich-text format selector.
const FORMAT_PARAMS: Record<string, string> = {
  'create-work-item': 'descriptionFormat',
  'update-work-item': 'descriptionFormat',
  'add-comment': 'bodyFormat',
  'get-comments': 'bodyFormat',
  'update-comment': 'bodyFormat',
  'get-work-item': 'descriptionFormat',
  'get-worklogs': 'commentFormat',
  'add-worklog': 'commentFormat',
};

// List-returning read actions whose templates render a markdown table
// (over this output collection field) before the JSON dump.
const TABLE_OUTPUTS: Record<
  string,
  { collection: string; header: string; linkedKey: boolean }
> = {
  'list-projects': {
    collection: 'projects',
    header: '| Key | Name | Description |',
    linkedKey: true,
  },
  'list-issue-types': {
    collection: 'issueTypes',
    header: '| Name | Description | Sub-task |',
    linkedKey: false,
  },
  'search-work-items': {
    collection: 'items',
    header: '| Key | Summary | Status | Type | Assignee |',
    linkedKey: true,
  },
  'search-users': {
    collection: 'users',
    header: '| Name | ID | Email |',
    linkedKey: false,
  },
  'list-transitions': {
    collection: 'transitions',
    header: '| Name | To status |',
    linkedKey: false,
  },
  'list-link-types': {
    collection: 'linkTypes',
    header: '| Name | Outward | Inward |',
    linkedKey: false,
  },
  'list-fields': {
    collection: 'fields',
    header: '| ID | Name | Custom | Type |',
    linkedKey: false,
  },
  'list-versions': {
    collection: 'versions',
    header: '| Name | Released | Release date | Description |',
    linkedKey: false,
  },
  'list-components': {
    collection: 'components',
    header: '| Name | Description | Lead |',
    linkedKey: false,
  },
  'get-remote-links': {
    collection: 'remoteLinks',
    header: '| Title | URL |',
    linkedKey: false,
  },
  'list-boards': {
    collection: 'boards',
    header: '| ID | Name | Type |',
    linkedKey: false,
  },
  'list-sprints': {
    collection: 'sprints',
    header: '| Name | State | Start | End |',
    linkedKey: false,
  },
};

// Read actions whose templates render each result as a section instead of a
// table row, before the JSON dump, mentioning these entry fields.
const SECTION_OUTPUTS: Record<
  string,
  { collection: string; mentions: string[] }
> = {
  'get-comments': {
    collection: 'comments',
    mentions: ['.author', '.created', '.body'],
  },
  'get-worklogs': {
    collection: 'worklogs',
    mentions: ['.author', '.timeSpent', '.started', '.comment'],
  },
};

const ACTION_NAMES = Object.keys(REQUIRED_INPUTS);

describe('jira actions test templates', () => {
  it('has one template file per action plus the location file', () => {
    const files = readdirSync(TEMPLATES_DIR).sort();
    expect(files).toEqual(
      [...ACTION_NAMES.map(name => `${name}.yaml`), 'all.yaml'].sort(),
    );
  });

  it('lists every template in the location file', () => {
    const location = parse(
      readFileSync(resolve(TEMPLATES_DIR, 'all.yaml'), 'utf8'),
    );
    expect(location.kind).toBe('Location');
    expect([...location.spec.targets].sort()).toEqual(
      ACTION_NAMES.map(name => `./${name}.yaml`).sort(),
    );
  });

  describe.each(ACTION_NAMES)('%s.yaml', actionName => {
    const template = parse(
      readFileSync(resolve(TEMPLATES_DIR, `${actionName}.yaml`), 'utf8'),
    );

    it('is a template with a single step invoking the registry action directly', () => {
      expect(template.kind).toBe('Template');
      expect(template.metadata.name).toBe(`jira-test-${actionName}`);
      expect(template.spec.steps).toHaveLength(1);
      const step = template.spec.steps[0];
      expect(step.action).toBe(`jira-actions:${actionName}`);
    });

    it('requires exactly the action-required parameters', () => {
      const required = template.spec.parameters.flatMap(
        (page: { required?: string[] }) => page.required ?? [],
      );
      expect(required.sort()).toEqual([...REQUIRED_INPUTS[actionName]].sort());
    });

    it('passes every declared parameter into the action input', () => {
      const properties = template.spec.parameters.flatMap(
        (page: { properties?: object }) => Object.keys(page.properties ?? {}),
      );
      const stepInput = template.spec.steps[0].input;
      expect(Object.keys(stepInput).sort()).toEqual(properties.sort());
      for (const name of properties) {
        expect(String(stepInput[name])).toContain(`\${{ parameters.${name} }}`);
      }
    });

    it('offers an entity picker for entityRef on project-scoped actions', () => {
      const properties = template.spec.parameters.flatMap(
        (page: { properties?: Record<string, any> }) =>
          Object.entries(page.properties ?? {}),
      );
      const entityRef = properties.find(
        ([name]: [string, any]) => name === 'entityRef',
      )?.[1];
      const expected = ENTITY_REF_ACTIONS.includes(actionName)
        ? 'EntityPicker'
        : undefined;
      expect(entityRef?.['ui:field']).toBe(expected);
    });

    it('offers the rich text format enum where applicable', () => {
      const param = FORMAT_PARAMS[actionName];
      const properties = template.spec.parameters.flatMap(
        (page: { properties?: Record<string, any> }) =>
          Object.entries(page.properties ?? {}),
      );
      const formatProperty = properties.find(
        ([name]: [string, any]) => name === param,
      )?.[1];
      const expected = param ? ['markdown', 'adf', 'text'] : undefined;
      expect(formatProperty?.enum).toEqual(expected);
    });

    it('renders list results as a markdown table or sections plus a JSON dump', () => {
      const table = TABLE_OUTPUTS[actionName];
      const section = SECTION_OUTPUTS[actionName];
      const collection = table?.collection ?? section?.collection;
      const texts = template.spec.output?.text ?? [];
      expect(texts).toHaveLength(collection ? 2 : 1);
      const first = texts[0]?.content ?? '';
      const last = texts[texts.length - 1]?.content ?? '';
      expect(first.includes('{% for')).toBe(Boolean(collection));
      expect(
        !collection || first.includes(`steps.invoke.output.${collection}`),
      ).toBe(true);
      expect(!collection || !first.includes('dump')).toBe(true);
      expect(!table || first.includes(table.header)).toBe(true);
      expect(!table || first.includes('| --- |')).toBe(true);
      const linkedKeyCell = /\[\$\{\{ \w+\.key \}\}\]\(\$\{\{ \w+\.url \}\}\)/;
      expect(!table?.linkedKey || linkedKeyCell.test(first)).toBe(true);
      expect(
        !section ||
          (section.mentions.every(mention => first.includes(mention)) &&
            first.includes('---')),
      ).toBe(true);
      expect(last).toContain('| dump(2)');
    });

    it('renders the result and links to the issue where the output has a url', () => {
      const texts = template.spec.output?.text ?? [];
      expect(
        texts.some((entry: { content?: string }) =>
          entry.content?.includes('steps.invoke.output'),
        ),
      ).toBe(true);
      const issueScoped = [
        'create-work-item',
        'update-work-item',
        'rename-work-item',
        'set-work-item-parent',
        'get-work-item',
        'add-comment',
        'get-comments',
        'update-comment',
        'add-label',
        'remove-label',
        'add-remote-link',
        'get-remote-links',
        'link-work-items',
        'transition-work-item',
        'get-worklogs',
        'add-worklog',
        'add-watcher',
        'remove-watcher',
      ];
      const links = template.spec.output?.links ?? [];
      const expectedLinks = issueScoped.includes(actionName)
        ? [
            {
              title: 'Open issue',
              url: '${{ steps.invoke.output.url }}',
            },
          ]
        : [];
      expect(links).toEqual(expectedLinks);
    });
  });
});
