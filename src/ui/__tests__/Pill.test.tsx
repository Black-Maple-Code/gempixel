// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { Pill } from '../Pill';

/**
 * Pill primitive contract (D-02 / SC1). Raw `preact` render() + jsdom harness
 * (mirrors StepBar.test.tsx). Asserts the display <span> element, the three
 * token-driven variants (neutral/ok/tag), the shared 20px pill radius, the
 * className-last merge, and that children text renders inside the span.
 */
describe('Pill — variant map + cn() merge contract', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    vi.restoreAllMocks();
  });

  const pill = () => container.querySelector('span') as HTMLSpanElement;

  it('renders a <span> display chip (not a button)', () => {
    render(<Pill>chip</Pill>, container);
    expect(pill()).not.toBeNull();
    expect(container.querySelector('button')).toBeNull();
    expect(pill().textContent).toBe('chip');
  });

  it('variant="neutral" applies bg-panel-2 + text-muted', () => {
    render(<Pill variant="neutral">N</Pill>, container);
    expect(pill().className).toContain('bg-panel-2');
    expect(pill().className).toContain('text-muted');
  });

  it('variant="ok" applies the accent-tint recipe (text-accent on #EAF2EF)', () => {
    render(<Pill variant="ok">OK</Pill>, container);
    expect(pill().className).toContain('text-accent');
    expect(pill().className).toContain('bg-[#EAF2EF]');
  });

  it('variant="tag" applies an uppercase mono chip style', () => {
    render(<Pill variant="tag">best</Pill>, container);
    expect(pill().className).toContain('uppercase');
    expect(pill().className).toContain('font-mono');
  });

  it('every variant applies the 20px pill radius', () => {
    render(<Pill variant="ok">R</Pill>, container);
    expect(pill().className).toContain('rounded-[var(--radius-pill)]');
  });

  it('merges a consumer className LAST into the class attribute', () => {
    render(<Pill className="my-extra">X</Pill>, container);
    const cls = pill().className;
    expect(cls).toContain('my-extra');
    expect(cls.trim().endsWith('my-extra')).toBe(true);
  });
});
