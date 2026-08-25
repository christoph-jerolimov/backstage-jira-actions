import { adfToMarkdown, adfToText, markdownToAdf, textToAdf } from './adf';

describe('textToAdf', () => {
  it('wraps lines into paragraphs', () => {
    expect(textToAdf('one\ntwo')).toEqual({
      type: 'doc',
      version: 1,
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'two' }] },
      ],
    });
  });
});

describe('adfToText', () => {
  it('renders paragraphs joined by newlines', () => {
    expect(adfToText(textToAdf('one\ntwo'))).toBe('one\ntwo');
  });

  it('renders headings, lists, and code blocks as lines', () => {
    const doc = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Title' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'first' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'second' }],
                },
              ],
            },
          ],
        },
        {
          type: 'codeBlock',
          content: [{ type: 'text', text: 'const x = 1;' }],
        },
      ],
    };
    expect(adfToText(doc)).toBe('Title\nfirst\nsecond\nconst x = 1;');
  });

  it('concatenates inline nodes and renders hard breaks', () => {
    const doc = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'a' },
            { type: 'hardBreak' },
            { type: 'text', text: 'b', marks: [{ type: 'strong' }] },
          ],
        },
      ],
    };
    expect(adfToText(doc)).toBe('a\nb');
  });

  it('passes plain strings through', () => {
    expect(adfToText('plain text')).toBe('plain text');
  });

  it('yields undefined for non-string, non-ADF values', () => {
    expect(adfToText(undefined)).toBeUndefined();
    expect(adfToText(null)).toBeUndefined();
    expect(adfToText(42)).toBeUndefined();
    expect(adfToText({ some: 'object' })).toBeUndefined();
  });
});

describe('markdownToAdf', () => {
  it('converts headings, lists, code blocks, and links to ADF nodes', () => {
    const adf = markdownToAdf(
      [
        '# Steps',
        '',
        '- first',
        '- second',
        '',
        '```ts',
        'const x = 1;',
        '```',
        '',
        'See [docs](https://example.com/docs).',
      ].join('\n'),
    );

    expect(adf).toEqual({
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Steps' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'first' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'second' }],
                },
              ],
            },
          ],
        },
        {
          type: 'codeBlock',
          attrs: { language: 'ts' },
          content: [{ type: 'text', text: 'const x = 1;' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'See ' },
            {
              type: 'text',
              text: 'docs',
              marks: [
                { type: 'link', attrs: { href: 'https://example.com/docs' } },
              ],
            },
            { type: 'text', text: '.' },
          ],
        },
      ],
    });
  });

  it('converts ordered lists and blockquotes', () => {
    const adf = markdownToAdf('1. one\n2. two\n\n> quoted');
    expect(adf.content).toEqual([
      {
        type: 'orderedList',
        content: [
          {
            type: 'listItem',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
            ],
          },
          {
            type: 'listItem',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'two' }] },
            ],
          },
        ],
      },
      {
        type: 'blockquote',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'quoted' }] },
        ],
      },
    ]);
  });

  it('converts inline bold, italic, and code marks', () => {
    const adf = markdownToAdf('a **bold** and *em* and `code`');
    expect(adf.content).toEqual([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'a ' },
          { type: 'text', text: 'bold', marks: [{ type: 'strong' }] },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'em', marks: [{ type: 'em' }] },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'code', marks: [{ type: 'code' }] },
        ],
      },
    ]);
  });

  it('converts plain text to simple paragraphs with hard breaks', () => {
    expect(markdownToAdf('First line\nSecond line')).toEqual({
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'First line' },
            { type: 'hardBreak' },
            { type: 'text', text: 'Second line' },
          ],
        },
      ],
    });
    expect(markdownToAdf('one\n\ntwo').content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'two' }] },
    ]);
  });

  it('degrades unsupported constructs to text without failing', () => {
    const adf = markdownToAdf(
      '| a | b |\n| - | - |\n| 1 | 2 |\n\nafter <b>html</b>',
    );
    const types = (adf.content as Array<{ type: string }>).map(n => n.type);
    expect(types.every(t => ['paragraph'].includes(t))).toBe(true);
    const text = JSON.stringify(adf);
    expect(text).toContain('after ');
  });
});

describe('adfToMarkdown', () => {
  it('renders the subset back to markdown', () => {
    const markdown = [
      '## Steps',
      '',
      '- first',
      '- second',
      '',
      '```ts',
      'const x = 1;',
      '```',
      '',
      'See [docs](https://example.com/docs) for **bold** and *em* and `code`.',
    ].join('\n');

    expect(adfToMarkdown(markdownToAdf(markdown))).toBe(markdown);
  });

  it('round-trips ordered lists, blockquotes, and hard breaks', () => {
    const markdown = ['1. one', '2. two', '', '> quoted', '', 'a\nb'].join(
      '\n',
    );
    expect(adfToMarkdown(markdownToAdf(markdown))).toBe(markdown);
  });

  it('passes plain strings through', () => {
    expect(adfToMarkdown('plain')).toBe('plain');
  });

  it('yields undefined for non-string, non-ADF values', () => {
    expect(adfToMarkdown(undefined)).toBeUndefined();
    expect(adfToMarkdown(42)).toBeUndefined();
    expect(adfToMarkdown({ some: 'object' })).toBeUndefined();
  });

  it('degrades nodes outside the subset to their text content', () => {
    const doc = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'cell' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'mention', attrs: { text: '@user' } },
            { type: 'text', text: ' after' },
          ],
        },
      ],
    };
    const markdown = adfToMarkdown(doc);
    expect(markdown).toContain('cell');
    expect(markdown).toContain('after');
  });
});
