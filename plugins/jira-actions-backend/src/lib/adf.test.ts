import { adfToText, textToAdf } from './adf';

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
