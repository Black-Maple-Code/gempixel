// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, h } from 'preact';
import { useWizard, type WizardApi } from '../useWizard';

type Deps = { hasImage: boolean; hasMatch: boolean; isTestEnv: boolean };

function mount(initial: Deps) {
  const container = document.createElement('div');
  let api!: WizardApi;
  let deps = initial;
  function Harness() {
    api = useWizard(deps);
    return null;
  }
  render(h(Harness, {}), container);
  const flush = async () => {
    await new Promise(r => setTimeout(r, 0));
    render(h(Harness, {}), container);
  };
  return {
    get api() {
      return api;
    },
    async act(fn: () => void, next?: Deps) {
      fn();
      if (next) deps = next;
      await flush();
    },
  };
}

describe('useWizard', () => {
  it('gates steps 3/4 on a match and step 2 on an image (canEnter = pure validity)', () => {
    const noData = mount({ hasImage: false, hasMatch: false, isTestEnv: false });
    expect(noData.api.canEnter(1)).toBe(true);
    expect(noData.api.canEnter(2)).toBe(false);
    expect(noData.api.canEnter(3)).toBe(false);
    expect(noData.api.canEnter(4)).toBe(false);

    const withImage = mount({ hasImage: true, hasMatch: false, isTestEnv: false });
    expect(withImage.api.canEnter(2)).toBe(true);
    expect(withImage.api.canEnter(3)).toBe(false);

    const withMatch = mount({ hasImage: true, hasMatch: true, isTestEnv: false });
    expect(withMatch.api.canEnter(3)).toBe(true);
    expect(withMatch.api.canEnter(4)).toBe(true);
  });

  it('does not bake the isTestEnv bypass into canEnter', () => {
    const h = mount({ hasImage: false, hasMatch: false, isTestEnv: true });
    expect(h.api.canEnter(2)).toBe(false); // Next button stays locked in tests
    expect(h.api.canEnter(3)).toBe(false);
  });

  it('advances/retreats and clamps at the ends', async () => {
    const w = mount({ hasImage: true, hasMatch: true, isTestEnv: false });
    expect(w.api.step).toBe(1);
    await w.act(() => w.api.next());
    expect(w.api.step).toBe(2);
    await w.act(() => w.api.next());
    await w.act(() => w.api.next());
    await w.act(() => w.api.next()); // clamp at 4
    expect(w.api.step).toBe(4);
    await w.act(() => w.api.back());
    expect(w.api.step).toBe(3);
    await w.act(() => w.api.reset());
    expect(w.api.step).toBe(1);
  });

  it('goTo blocks an invalid jump but allows it under isTestEnv', async () => {
    const locked = mount({ hasImage: true, hasMatch: false, isTestEnv: false });
    await locked.act(() => locked.api.goTo(3)); // hasMatch false -> blocked
    expect(locked.api.step).toBe(1);

    const bypass = mount({ hasImage: false, hasMatch: false, isTestEnv: true });
    await bypass.act(() => bypass.api.goTo(3)); // isTestEnv -> allowed
    expect(bypass.api.step).toBe(3);
  });
});
