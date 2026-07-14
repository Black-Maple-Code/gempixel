// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { Slider } from '../Slider';

/**
 * Slider primitive contract (SC2 / D-04). Props-driven render via the raw `preact`
 * render() + jsdom harness (mirrors StepBar.test.tsx). Asserts a native
 * input[type=range], aria-label + aria-valuetext, min/max/step passthrough (step
 * defaults to 1), the accent tint, className-last merge, and — the key Preact trap —
 * that a bubbling `input` event (NOT `change`) drives onChange with the parsed number.
 * Fully controlled — no internal value state. No network/build.
 */
describe('Slider — native range + onInput + a11y strings', () => {
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

  const range = () => container.querySelector('input[type=range]') as HTMLInputElement;

  it('renders a native <input type="range">', () => {
    render(
      <Slider value={3} onChange={vi.fn()} min={1} max={26} ariaLabel="Color count" />,
      container,
    );
    expect(range()).not.toBeNull();
    expect(range().type).toBe('range');
  });

  it('applies aria-label and aria-valuetext from props', () => {
    render(
      <Slider
        value={24}
        onChange={vi.fn()}
        min={1}
        max={26}
        ariaLabel="Color count"
        ariaValueText="24 of 26 matched"
      />,
      container,
    );
    expect(range().getAttribute('aria-label')).toBe('Color count');
    expect(range().getAttribute('aria-valuetext')).toBe('24 of 26 matched');
  });

  it('reflects min/max/step (step defaults to 1)', () => {
    render(
      <Slider value={3} onChange={vi.fn()} min={2} max={40} ariaLabel="x" />,
      container,
    );
    expect(range().getAttribute('min')).toBe('2');
    expect(range().getAttribute('max')).toBe('40');
    expect(range().getAttribute('step')).toBe('1');

    render(
      <Slider value={3} onChange={vi.fn()} min={2} max={40} step={5} ariaLabel="x" />,
      container,
    );
    expect(range().getAttribute('step')).toBe('5');
  });

  it('fires onChange(number) on a bubbling input event (onInput, not commit)', () => {
    const onChange = vi.fn();
    render(
      <Slider value={3} onChange={onChange} min={1} max={26} ariaLabel="x" />,
      container,
    );
    const el = range();
    el.value = '5';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('tints the native control with the accent color', () => {
    render(
      <Slider value={3} onChange={vi.fn()} min={1} max={26} ariaLabel="x" />,
      container,
    );
    expect(range().className).toContain('accent-[var(--accent)]');
  });

  it('merges a consumer className LAST into the class attribute', () => {
    render(
      <Slider value={3} onChange={vi.fn()} min={1} max={26} ariaLabel="x" className="my-extra" />,
      container,
    );
    const cls = range().className;
    expect(cls).toContain('my-extra');
    expect(cls.trim().endsWith('my-extra')).toBe(true);
  });

  it('spreads remaining native attributes via ...rest', () => {
    render(
      <Slider value={3} onChange={vi.fn()} min={1} max={26} ariaLabel="x" id="count-slider" />,
      container,
    );
    expect(range().id).toBe('count-slider');
  });
});
