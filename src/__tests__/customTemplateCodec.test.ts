// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { customTemplateCodec, DEFAULT_CANVAS_TEMPLATE } from '../App';

// WR-03: the custom-canvas checkout template codec must restore the pre-migration
// `saved || DEFAULT` fallback so a template-less/imported project that persisted an
// empty string recovers the default instead of round-tripping to '' (which produces
// a broken custom-canvas checkout URL).
describe('customTemplateCodec (WR-03)', () => {
  it('resolves an empty stored value to the default template', () => {
    expect(customTemplateCodec.parse('')).toBe(DEFAULT_CANVAS_TEMPLATE);
  });

  it('resolves a whitespace-only stored value to the default template', () => {
    expect(customTemplateCodec.parse('   ')).toBe(DEFAULT_CANVAS_TEMPLATE);
  });

  it('normalizes the legacy heartfuldiamonds host to the default template', () => {
    expect(customTemplateCodec.parse('https://heartfuldiamonds.com/x?size={size}')).toBe(
      DEFAULT_CANVAS_TEMPLATE
    );
  });

  it('passes a real custom template through verbatim', () => {
    const custom = 'https://example.com/custom?size={size}&shape={shape}';
    expect(customTemplateCodec.parse(custom)).toBe(custom);
  });

  it('serialize is identity so the on-disk format is unchanged', () => {
    const custom = 'https://example.com/custom?size={size}';
    expect(customTemplateCodec.serialize(custom)).toBe(custom);
    expect(customTemplateCodec.serialize('')).toBe('');
  });
});
