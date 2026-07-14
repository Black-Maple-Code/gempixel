// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { SizeCard } from '../SizeCard';

/**
 * SizeCard primitive contract (D-05 / SC1). Props-only, dumb selectable card
 * rendered via the raw `preact` render() + jsdom harness (mirrors
 * Button.test.tsx / StepBar.test.tsx). Asserts the native
 * <button type="button" aria-pressed> selection semantics, that every displayed
 * value comes straight from props (label / gridDims / inches / drillCount), the
 * mono drill-count data figure, the visually-distinct selected vs default border
 * recipe, the optional `tag`, the className-last merge, and onSelect firing on
 * click. No engine coupling, no derivation. No network/build.
 */
describe('SizeCard — dumb selectable card contract (D-05)', () => {
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

  const card = () => container.querySelector('button') as HTMLButtonElement;

  const base = {
    label: 'Medium',
    gridDims: '80×53',
    inches: '16 × 10.6 in',
    drillCount: 4240,
    selected: false,
    onSelect: () => {},
  };

  it('renders a native <button> with type="button"', () => {
    render(<SizeCard {...base} />, container);
    expect(card()).not.toBeNull();
    expect(card().getAttribute('type')).toBe('button');
  });

  it('reflects selected=false via aria-pressed="false"', () => {
    render(<SizeCard {...base} selected={false} />, container);
    expect(card().getAttribute('aria-pressed')).toBe('false');
  });

  it('reflects selected=true via aria-pressed="true"', () => {
    render(<SizeCard {...base} selected />, container);
    expect(card().getAttribute('aria-pressed')).toBe('true');
  });

  it('renders label, gridDims, inches, and drillCount straight from props', () => {
    render(<SizeCard {...base} />, container);
    const text = card().textContent ?? '';
    expect(text).toContain('Medium');
    expect(text).toContain('80×53');
    expect(text).toContain('16 × 10.6 in');
    expect(text).toContain('4240');
  });

  it('renders drillCount inside a font-mono data figure', () => {
    render(<SizeCard {...base} />, container);
    const mono = card().querySelector('.font-mono');
    expect(mono).not.toBeNull();
    expect(mono?.textContent).toContain('4240');
  });

  it('selected=true applies the accent border + tint recipe', () => {
    render(<SizeCard {...base} selected />, container);
    const cls = card().className;
    expect(cls).toContain('border-accent');
    expect(cls).toContain('bg-[#EAF2EF]');
    expect(cls).not.toContain('border-border');
  });

  it('selected=false applies the neutral border', () => {
    render(<SizeCard {...base} selected={false} />, container);
    const cls = card().className;
    expect(cls).toContain('border-border');
    expect(cls).not.toContain('border-accent');
  });

  it('renders the tag text when provided', () => {
    render(<SizeCard {...base} tag="BEST FOR ART" />, container);
    expect(card().textContent ?? '').toContain('BEST FOR ART');
  });

  it('renders no tag element when tag is omitted', () => {
    render(<SizeCard {...base} />, container);
    expect(card().textContent ?? '').not.toContain('BEST');
  });

  it('fires onSelect exactly once on click', () => {
    const onSelect = vi.fn();
    render(<SizeCard {...base} onSelect={onSelect} />, container);
    card().click();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('merges a consumer className LAST into the class attribute', () => {
    render(<SizeCard {...base} className="my-extra" />, container);
    const cls = card().className;
    expect(cls).toContain('my-extra');
    expect(cls.trim().endsWith('my-extra')).toBe(true);
  });
});
