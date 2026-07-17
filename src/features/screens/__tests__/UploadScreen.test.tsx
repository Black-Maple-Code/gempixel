// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { UploadScreen, type UploadScreenProps } from '../UploadScreen';
import type { ProjectSummary } from '../../../engine/projectStore';

/**
 * UploadScreen render contract (UPLOAD-01 / D-10). Props-driven, jsdom-only,
 * deterministic — no worker, no canvas, no network. Mirrors the StepBar test
 * harness (detached container, render(null) teardown, vi.fn() stubs).
 *
 * Covers: title + Browse button presence, recent-projects chip rendering +
 * loadProject-on-click, empty-registry omits the RECENT row, the T-23-02-01
 * filename-escaping mitigation (a crafted markup name renders as text, never an
 * element), and the absence of any canvas-size control (size moved to Refine).
 */
describe('UploadScreen — render contract (UPLOAD-01 / D-10)', () => {
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

  const baseProps = (
    projectsRegistry: ProjectSummary[],
    overrides: Partial<UploadScreenProps> = {},
  ): UploadScreenProps => ({
    dropZoneRef: { current: null },
    isDragOver: false,
    handleFileChange: vi.fn(),
    handleDragOver: vi.fn(),
    handleDragLeave: vi.fn(),
    handleDrop: vi.fn(),
    projectsRegistry,
    loadProject: vi.fn(),
    onDeleteProject: vi.fn(),
    ...overrides,
  });

  const project = (id: string, name: string): ProjectSummary => ({
    id,
    name,
    thumbnail: '',
    dateModified: '2026-07-14T00:00:00.000Z',
    dateCreated: '2026-07-14T00:00:00.000Z',
  });

  const buttonByText = (text: string) =>
    Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes(text),
    ) as HTMLButtonElement | undefined;

  it('renders the title and a native Browse files button', () => {
    render(<UploadScreen {...baseProps([])} />, container);

    expect(container.textContent).toContain('Photo → Diamond chart');

    const browse = buttonByText('Browse files');
    expect(browse).toBeTruthy();
    expect(browse!.tagName).toBe('BUTTON');
  });

  it('renders one chip per project and calls loadProject(id) on click', () => {
    const props = baseProps([project('p1', 'Sunset'), project('p2', 'Mountains')]);
    render(<UploadScreen {...props} />, container);

    expect(container.textContent).toContain('Sunset');
    expect(container.textContent).toContain('Mountains');

    const chip = buttonByText('Mountains');
    expect(chip).toBeTruthy();
    chip!.click();
    expect(props.loadProject).toHaveBeenCalledWith('p2');
  });

  it('Remove → Yes calls onDeleteProject(id) — the saved-projects delete path (CR-01)', async () => {
    const props = baseProps([project('p1', 'Sunset')]);
    render(<UploadScreen {...props} />, container);

    // Reveal the confirm affordance (Preact flushes the setState re-render on the
    // next microtask, so await a tick before reading the confirm UI).
    const remove = buttonByText('Remove');
    expect(remove).toBeTruthy();
    remove!.click();
    await new Promise((r) => setTimeout(r, 0));

    // Confirm "Yes" must delete the SAVED PROJECT by its id — never the recents list.
    const yes = buttonByText('Yes');
    expect(yes).toBeTruthy();
    yes!.click();

    expect(props.onDeleteProject).toHaveBeenCalledWith('p1');
  });

  it('omits the RECENT label when the projects registry is empty', () => {
    render(<UploadScreen {...baseProps([])} />, container);
    expect(container.textContent).not.toContain('Recent');
  });

  it('escapes a crafted markup project name (T-23-02-01: no XSS sink)', () => {
    const crafted = '<img src=x onerror="alert(1)">';
    render(<UploadScreen {...baseProps([project('x1', crafted)])} />, container);

    // The malicious string is present as TEXT…
    expect(container.textContent).toContain(crafted);
    // …but no element was injected from it (the only <img> is the empty thumbnail,
    // which carries no onerror handler).
    expect(container.querySelector('img[onerror]')).toBeNull();
  });

  it('renders NO canvas-size control (size moved to Refine — SC1/D-10)', () => {
    render(<UploadScreen {...baseProps([project('p1', 'Sunset')])} />, container);
    expect(container.querySelector('input[type="number"]')).toBeNull();
    expect(container.querySelector('#preset-size-select')).toBeNull();
    expect(container.querySelector('input[data-field="width"]')).toBeNull();
  });
});
