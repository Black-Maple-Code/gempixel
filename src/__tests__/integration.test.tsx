// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { App } from '../App';

// Mock canvas viewer
vi.mock('../engine/viewer', () => {
  return {
    CanvasViewer: class MockCanvasViewer {
      setData = vi.fn();
      setDrillStyle = vi.fn();
      setHighlightedColor = vi.fn();
      destroy = vi.fn();
    }
  };
});

// Mock worker client to spy on match triggers
vi.mock('../engine/worker-client', () => {
  const mockMatch = vi.fn();
  return {
    MatcherClient: class MockMatcherClient {
      match = mockMatch;
      terminate = vi.fn();
    }
  };
});

describe('Integration Match Triggering and Palette Toggles', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('renders base checklist options correctly', () => {
    render(<App />, container);

    // Verify sub-palette checklist inputs exist
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    // Initially, there are a lot of checkboxes representing all palette colors
    expect(checkboxes.length).toBeGreaterThan(0);
  });
});
