// @vitest-environment jsdom
//
// Red spec for the Manual Edit save that never becomes visible.
//
// Manual Edit freezes the preview's document identity while it is open
// (`previewRuntimeRevisionIdentityRef` in FileViewer.tsx). The freeze is
// deliberate: the live edit bridge mirrors the persisted bytes into the
// document that is already on screen, so replacing that document would only
// re-render what the user is already looking at while discarding its JS heap,
// timers, canvas and scroll.
//
// The freeze is only justified while the bridge is actually keeping the
// document in sync. Six of the nine patch kinds have no bridge message at all
// (`set-link`, `set-image`, `remove-element`, `set-token`, `set-attributes`,
// `set-full-source`), so for those the freeze suppresses the reload without
// anything taking its place — the user saves, the file changes on disk, and
// the preview does not move.
//
// The retention latch has the same shape of hole. It decides
// `liveDocumentMatchesSavedSource` from the single patch it is handed, then
// fingerprints the WHOLE file. A session that saved a link (not mirrored) and
// then saved text (mirrored) re-arms the latch against a document the link
// edit never reached, and Manual Edit's exit adopts that stale document.
//
// Observable used here: the preview's scoped session id. A replaced document
// mints a new preview scope, so `data-od-session-id` moving is the witness
// that the user's save reached the screen, and it staying put is the witness
// that it did not. The third case pins the other direction — a save the bridge
// DID mirror must not mint a new scope — so a fix cannot pass by reloading
// unconditionally.

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { FileViewer as ProductFileViewer } from '../../src/components/FileViewer';
import { emptyManualEditStyles, type ManualEditTarget } from '../../src/edit-mode/types';
import type { ProjectFile } from '../../src/types';
import {
  installFileViewerPreviewRuntimeHarness,
  prepareSettledFileViewerFixture,
  setSyntheticPreviewFileSource,
  syntheticPreviewFileSource,
  uninstallFileViewerPreviewRuntimeHarness,
  useSyntheticProjectScopedPreviewNavigation,
} from '../helpers/file-viewer-preview-runtime';

vi.mock('../../src/providers/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/providers/registry')>();
  return {
    ...actual,
    fetchProjectFileText(
      projectId: string,
      name: string,
      options?: Parameters<typeof actual.fetchProjectFileText>[2],
    ) {
      const source = syntheticPreviewFileSource(projectId, name);
      return source === undefined
        ? actual.fetchProjectFileText(projectId, name, options)
        : Promise.resolve(source);
    },
  };
});

vi.mock('../../src/runtime/use-project-preview-session-navigation', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../src/runtime/use-project-preview-session-navigation')
  >();
  return {
    ...actual,
    useProjectScopedPreviewNavigation: (
      options: Parameters<typeof actual.useProjectScopedPreviewNavigation>[0],
    ) => useSyntheticProjectScopedPreviewNavigation(options),
  };
});

function FileViewer(props: ComponentProps<typeof ProductFileViewer>) {
  return <ProductFileViewer {...prepareSettledFileViewerFixture(props)} />;
}

beforeEach(() => {
  installFileViewerPreviewRuntimeHarness();
});

afterEach(() => {
  uninstallFileViewerPreviewRuntimeHarness();
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const PROJECT_ID = 'project-1';
const FILE_NAME = 'preview.html';

// A call-to-action authored the way real pages author one, next to an ordinary
// text leaf. `inferKind` in the preview runtime classifies any <a> as `link`,
// so the anchor is the ordinary shape of a link target and the <main> is the
// ordinary shape of a text target.
const PAGE_SOURCE =
  '<!doctype html><html><body>'
  + '<a data-od-id="cta" href="./tokens.css">View tokens<svg viewBox="0 0 24 24"></svg></a>'
  + '<main data-od-id="hero">Hero</main>'
  + '</body></html>';

function linkTarget(): ManualEditTarget {
  return {
    id: 'cta',
    kind: 'link',
    label: 'View tokens',
    tagName: 'a',
    className: 'btn btn-primary',
    text: 'View tokens',
    rect: { x: 16, y: 358, width: 250, height: 40 },
    fields: { text: 'View tokens', href: './tokens.css' },
    attributes: { 'data-od-id': 'cta', href: './tokens.css' },
    styles: emptyManualEditStyles(),
    isLayoutContainer: false,
    outerHtml: '<a data-od-id="cta" href="./tokens.css">View tokens<svg viewBox="0 0 24 24"></svg></a>',
  };
}

function textTarget(): ManualEditTarget {
  return {
    id: 'hero',
    kind: 'text',
    label: 'Hero',
    tagName: 'main',
    className: '',
    text: 'Hero',
    rect: { x: 24, y: 24, width: 160, height: 48 },
    fields: { text: 'Hero' },
    attributes: { 'data-od-id': 'hero' },
    styles: emptyManualEditStyles(),
    isLayoutContainer: false,
    outerHtml: '<main data-od-id="hero">Hero</main>',
  };
}

function htmlPreviewFile(size = 1024, mtime = 1710000000): ProjectFile {
  return {
    name: FILE_NAME,
    path: FILE_NAME,
    type: 'file',
    size,
    mtime,
    mime: 'text/html',
    kind: 'html',
    artifactManifest: {
      version: 1,
      kind: 'html',
      title: 'Preview',
      entry: FILE_NAME,
      renderer: 'html',
      exports: ['html'],
    },
  };
}

/**
 * The scoped preview session currently on screen. A replaced document always
 * carries a freshly minted scope, so this is the witness for "the user's save
 * reached the preview".
 */
function liveSessionId(): string {
  const frame = screen.getByTestId('artifact-preview-frame') as HTMLIFrameElement;
  const session = frame.dataset.odSessionId;
  if (!session) throw new Error('Preview frame has no scoped session');
  return session;
}

describe('FileViewer manual edit — a save the bridge cannot mirror', () => {
  /**
   * Drives the real product flow: mount the viewer on a settled HTML document,
   * open Manual Edit, and answer the runtime-state capture the way the preview
   * runtime does. Returns the levers the cases need.
   */
  async function openManualEdit() {
    let currentFile = htmlPreviewFile();
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof Request ? input.url : String(input);
      if (url.includes(`/api/projects/${PROJECT_ID}/files`) && init?.method === 'POST') {
        // Persist exactly what the product wrote, then answer with the file
        // metadata a real save produces. The watcher echo that follows a save
        // is modelled by re-rendering with this file.
        const body = typeof init.body === 'string' ? init.body : '';
        try {
          const parsed = JSON.parse(body) as { content?: string };
          if (typeof parsed.content === 'string') {
            setSyntheticPreviewFileSource(PROJECT_ID, FILE_NAME, parsed.content);
            currentFile = htmlPreviewFile(parsed.content.length, currentFile.mtime + 1);
          }
        } catch {
          /* not a file write */
        }
        return new Response(JSON.stringify({ file: currentFile }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(PAGE_SOURCE, { status: 200, headers: { 'Content-Type': 'text/html' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const view = render(
      <FileViewer
        projectId={PROJECT_ID}
        projectKind="prototype"
        file={htmlPreviewFile()}
        liveHtml={PAGE_SOURCE}
      />,
    );

    const frame = await waitFor(() => {
      const node = screen.getByTestId('artifact-preview-frame') as HTMLIFrameElement;
      if (!node.contentWindow) throw new Error('Preview frame not ready');
      return node;
    });

    const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage');
    fireEvent.click(screen.getByTestId('manual-edit-mode-toggle'));
    const captureRequest = postMessage.mock.calls
      .map(([value]) => value)
      .find((value) => (
        typeof value === 'object'
        && value !== null
        && (value as { type?: unknown }).type === 'od:preview-runtime-state-capture'
      )) as { id: string } | undefined;
    if (captureRequest) {
      act(() => {
        window.dispatchEvent(new MessageEvent('message', {
          data: {
            type: 'od:preview-runtime-state-captured',
            id: captureRequest.id,
            state: { version: 1, hash: '', htmlAttrs: {}, bodyAttrs: {}, entries: [] },
          },
          source: frame.contentWindow,
        }));
      });
    }
    await waitFor(() => {
      expect(screen.getByTestId('manual-edit-mode-toggle').getAttribute('aria-pressed')).toBe('true');
    });

    // The bridge lives in the preview document; nothing here should reach a
    // jsdom window that cannot host it.
    const previewWindow = (screen.getByTestId('artifact-preview-frame') as HTMLIFrameElement)
      .contentWindow!;
    vi.spyOn(previewWindow, 'postMessage').mockImplementation(() => {});

    /** Settle the save's async work and deliver the watcher echo. */
    async function settle() {
      await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 80); }); });
      view.rerender(
        <FileViewer projectId={PROJECT_ID} projectKind="prototype" file={currentFile} />,
      );
      await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 80); }); });
    }

    /** Pick a target and save new text through the properties panel. */
    async function saveTextThroughPanel(target: ManualEditTarget, value: string) {
      const active = screen.getByTestId('artifact-preview-frame') as HTMLIFrameElement;
      act(() => {
        window.dispatchEvent(new MessageEvent('message', {
          data: { type: 'od-edit-select', target },
          source: active.contentWindow,
        }));
      });
      await waitFor(() => {
        expect(document.querySelector('.manual-edit-right')).not.toBeNull();
      });
      const textarea = document.querySelector('.manual-edit-right textarea') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value } });
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          `/api/projects/${PROJECT_ID}/files`,
          expect.objectContaining({ method: 'POST' }),
        );
      });
      await settle();
    }

    async function leaveManualEdit() {
      fireEvent.click(screen.getByTestId('manual-edit-mode-toggle'));
      await settle();
    }

    return { leaveManualEdit, saveTextThroughPanel };
  }

  // Root cause A. `set-link` has no `od-edit-preview-*` message, so nothing
  // carries the persisted bytes into the frozen document. With no bridge to
  // stand in for the reload, the freeze has nothing left to protect and the
  // save must become visible the ordinary way.
  it('refreshes the preview document when the save had no live bridge', async () => {
    const { saveTextThroughPanel } = await openManualEdit();
    const before = liveSessionId();

    await saveTextThroughPanel(linkTarget(), 'View tokens EDIT1');

    expect(syntheticPreviewFileSource(PROJECT_ID, FILE_NAME)).toContain('View tokens EDIT1');
    expect(liveSessionId()).not.toBe(before);
  });

  // Root cause B. The latch is armed from one patch but fingerprints the whole
  // file, so a mirrored save can vouch for a document an earlier unmirrored
  // save never reached. Manual Edit then exits onto the stale document and the
  // user sees EDIT1 while the file on disk says EDIT2.
  it('shows the persisted revision after leaving an edit session that saved without a bridge', async () => {
    const { leaveManualEdit, saveTextThroughPanel } = await openManualEdit();
    const before = liveSessionId();

    await saveTextThroughPanel(linkTarget(), 'View tokens EDIT1');
    await saveTextThroughPanel(textTarget(), 'Hero EDIT2');
    await leaveManualEdit();

    const persisted = syntheticPreviewFileSource(PROJECT_ID, FILE_NAME) ?? '';
    expect(persisted).toContain('View tokens EDIT1');
    expect(persisted).toContain('Hero EDIT2');
    expect(liveSessionId()).not.toBe(before);
  });

  // The other direction, green today and required to stay green: a save the
  // bridge DID mirror keeps its document. Without this, "always reload" would
  // pass the two cases above while throwing away the live document the
  // retained-frame runtime exists to preserve.
  it('keeps the live document when the save was mirrored by the bridge', async () => {
    const { saveTextThroughPanel } = await openManualEdit();
    const before = liveSessionId();

    await saveTextThroughPanel(textTarget(), 'Hero EDIT1');

    expect(syntheticPreviewFileSource(PROJECT_ID, FILE_NAME)).toContain('Hero EDIT1');
    expect(liveSessionId()).toBe(before);
  });
});
