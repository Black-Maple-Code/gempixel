// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { SegmentedControl } from '../SegmentedControl';

/**
 * SegmentedControl WAI-ARIA radiogroup contract (SC2 / D-04). Props-driven render
 * via the raw `preact` render() + jsdom harness (mirrors StepBar.test.tsx). Asserts
 * role="radiogroup" + group aria-label, one role="radio" per option with mutually-
 * exclusive aria-checked, roving tabindex, click -> onChange, wrapping arrow/Home/End
 * keyboard selection, and the className-last merge. Fully controlled — no internal
 * value state. No network/build.
 */
describe('SegmentedControl — radiogroup + roving tabindex + arrow keys', () => {
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

  const opts = [
    { value: 'off', label: 'Off' },
    { value: 'light', label: 'Light' },
    { value: 'med', label: 'Med' },
    { value: 'strong', label: 'Strong' },
  ];

  const radios = () =>
    Array.from(container.querySelectorAll('[role="radio"]')) as HTMLButtonElement[];

  it('exposes role="radiogroup" with the group aria-label from the label prop', () => {
    render(
      <SegmentedControl value="light" onChange={vi.fn()} options={opts} label="Edge cleanup" />,
      container,
    );
    const group = container.querySelector('[role="radiogroup"]');
    expect(group).not.toBeNull();
    expect(group?.getAttribute('aria-label')).toBe('Edge cleanup');
  });

  it('renders one role="radio" per option with its label as visible text', () => {
    render(
      <SegmentedControl value="off" onChange={vi.fn()} options={opts} label="x" />,
      container,
    );
    const rs = radios();
    expect(rs).toHaveLength(4);
    expect(rs.map(r => r.textContent)).toEqual(['Off', 'Light', 'Med', 'Strong']);
  });

  it('marks only the selected option aria-checked="true" (mutually exclusive)', () => {
    render(
      <SegmentedControl value="med" onChange={vi.fn()} options={opts} label="x" />,
      container,
    );
    const rs = radios();
    expect(rs.map(r => r.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'true',
      'false',
    ]);
  });

  it('uses roving tabindex: selected option tabIndex 0, all others -1', () => {
    render(
      <SegmentedControl value="light" onChange={vi.fn()} options={opts} label="x" />,
      container,
    );
    const rs = radios();
    expect(rs.map(r => r.tabIndex)).toEqual([-1, 0, -1, -1]);
  });

  it('clicking an option calls onChange with that option value', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl value="off" onChange={onChange} options={opts} label="x" />,
      container,
    );
    radios()[2].click();
    expect(onChange).toHaveBeenCalledWith('med');
  });

  it('ArrowRight on the last option wraps to the first (selection follows focus)', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl value="strong" onChange={onChange} options={opts} label="x" />,
      container,
    );
    radios()[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('off');
  });

  it('ArrowLeft on the first option wraps to the last', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl value="off" onChange={onChange} options={opts} label="x" />,
      container,
    );
    radios()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('strong');
  });

  it('ArrowDown moves next and ArrowUp moves previous', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl value="light" onChange={onChange} options={opts} label="x" />,
      container,
    );
    const rs = radios();
    rs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith('med');
    rs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith('off');
  });

  it('Home selects the first option and End selects the last', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl value="med" onChange={onChange} options={opts} label="x" />,
      container,
    );
    const rs = radios();
    rs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith('off');
    rs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith('strong');
  });

  it('merges a consumer className LAST onto the radiogroup container', () => {
    render(
      <SegmentedControl
        value="off"
        onChange={vi.fn()}
        options={opts}
        label="x"
        className="my-extra"
      />,
      container,
    );
    const cls = container.querySelector('[role="radiogroup"]')?.className ?? '';
    expect(cls).toContain('my-extra');
    expect(cls.trim().endsWith('my-extra')).toBe(true);
  });
});
