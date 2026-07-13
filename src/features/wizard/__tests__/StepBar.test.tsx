// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { StepBar } from '../StepBar';
import { STEP_META } from '../stepMeta';

/**
 * StepBar D-12 gating + a11y contract. Props-driven render (stub canEnter/goTo);
 * asserts the four-step order, aria-current on the current step, aria-disabled +
 * out-of-tab-order on locked steps, and the locked-tap-no-op / enabled-tap-fires
 * navigation behavior. jsdom-only, deterministic, no build/network.
 */
describe('StepBar — D-12 gating + a11y contract', () => {
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

  const setup = (step: number, canEnter: (s: number) => boolean, goTo = vi.fn()) => {
    render(<StepBar step={step} canEnter={canEnter} goTo={goTo} />, container);
    const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];
    return { goTo, buttons };
  };

  // Strip the circle's number/check glyph, leaving just the label text.
  const labelOf = (b: HTMLButtonElement) => b.textContent?.replace(/[0-9✓]/g, '').trim();

  it('renders exactly 4 steps labeled Upload/Refine/Supplies/Order in order', () => {
    const { buttons } = setup(1, () => false);
    expect(buttons.length).toBe(4);
    expect(buttons.map(labelOf)).toEqual(['Upload', 'Refine', 'Supplies', 'Order']);
    // STEP_META is the single source of that label/order.
    expect(STEP_META.map(m => m.label)).toEqual(['Upload', 'Refine', 'Supplies', 'Order']);
  });

  it('marks the current step with aria-current="step" and no others', () => {
    const { buttons } = setup(2, s => s <= 2);
    expect(buttons[1].getAttribute('aria-current')).toBe('step');
    expect(buttons[0].getAttribute('aria-current')).toBeNull();
    expect(buttons[2].getAttribute('aria-current')).toBeNull();
  });

  it('locks upcoming steps: aria-disabled="true" and removed from tab order', () => {
    // step 2 current; canEnter false for 3 & 4 → both locked.
    const { buttons } = setup(2, s => s <= 2);
    const supplies = buttons[2];
    expect(supplies.getAttribute('aria-disabled')).toBe('true');
    expect(supplies.tabIndex).toBe(-1);
    // an enabled step stays in the tab order and is not aria-disabled.
    expect(buttons[0].getAttribute('aria-disabled')).toBeNull();
    expect(buttons[0].tabIndex).not.toBe(-1);
  });

  it('does NOT call goTo when a locked step is clicked (no dead-end)', () => {
    const { goTo, buttons } = setup(2, s => s <= 2);
    buttons[2].click(); // Supplies (locked)
    buttons[3].click(); // Order (locked)
    expect(goTo).not.toHaveBeenCalled();
  });

  it('calls goTo(index) when an enabled/completed step is clicked', () => {
    const { goTo, buttons } = setup(2, s => s <= 2);
    buttons[0].click(); // Upload (completed)
    expect(goTo).toHaveBeenCalledWith(1);
  });
});
