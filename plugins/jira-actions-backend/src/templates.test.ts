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
  'get-work-item': ['issueKey'],
  'search-work-items': [],
  'add-comment': ['issueKey', 'body'],
  'transition-work-item': ['issueKey', 'status'],
  'list-projects': [],
  'list-issue-types': [],
};

// Actions that accept a catalog entity ref as an alternative to a project
// key; their templates must offer an entity picker for it.
const ENTITY_REF_ACTIONS = [
  'create-work-item',
  'search-work-items',
  'list-issue-types',
];

// Actions whose templates carry a rich-text format selector.
const FORMAT_PARAMS: Record<string, string> = {
  'create-work-item': 'descriptionFormat',
  'update-work-item': 'descriptionFormat',
  'add-comment': 'bodyFormat',
  'get-work-item': 'descriptionFormat',
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
        'get-work-item',
        'add-comment',
        'transition-work-item',
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
