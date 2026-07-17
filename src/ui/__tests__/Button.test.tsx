// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { Button } from '../Button';
import { cn } from '../cn';

/**
 * Button primitive contract (D-02 / SC1). Props-driven render via the raw
 * `preact` render() + jsdom harness (mirrors StepBar.test.tsx). Asserts the
 * native <button type="button"> semantics, the three token-driven variant class
 * sets (primary/save/ghost), the className-last merge, disabled passthrough,
 * and that an onClick spread via ...rest fires on .click(). No network/build.
 */
describe('Button — variant map + cn() merge contract', () => {
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

  const btn = () => container.querySelector('button') as HTMLButtonElement;

  it('cn() filters falsy values and joins with a single space', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('renders a native <button> with type="button"', () => {
    render(<Button>Go</Button>, container);
    expect(btn()).not.toBeNull();
    expect(btn().getAttribute('type')).toBe('button');
    expect(btn().textContent).toBe('Go');
  });

  it('variant="primary" applies bg-accent + text-on-accent', () => {
    render(<Button variant="primary">P</Button>, container);
    expect(btn().className).toContain('bg-accent');
    expect(btn().className).toContain('text-on-accent');
  });

  it('variant="save" applies bg-ink + text-on-accent + rounded-[20px]', () => {
    render(<Button variant="save">S</Button>, container);
    expect(btn().className).toContain('bg-ink');
    expect(btn().className).toContain('text-on-accent');
    expect(btn().className).toContain('rounded-[20px]');
  });

  it('variant="ghost" applies border + border-border', () => {
    render(<Button variant="ghost">G</Button>, container);
    expect(btn().className).toContain('border');
    expect(btn().className).toContain('border-border');
  });

  it('merges a consumer className LAST into the class attribute', () => {
    render(<Button className="my-extra">X</Button>, container);
    const cls = btn().className;
    expect(cls).toContain('my-extra');
    // className is appended after the variant classes (source-order last).
    expect(cls.trim().endsWith('my-extra')).toBe(true);
  });

  it('passes disabled through to the native button', () => {
    render(<Button disabled>D</Button>, container);
    expect(btn().disabled).toBe(true);
  });

  it('fires an onClick spread via ...rest on .click()', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>C</Button>, container);
    btn().click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
