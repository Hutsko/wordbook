import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import EpubViewer from './EpubViewer';

// Mock the entire db module WITHOUT importing the actual file (to avoid import.meta)
jest.mock('../db', () => ({
  getReadingProgress: jest.fn().mockResolvedValue(null),
  updateReadingProgress: jest.fn().mockResolvedValue(undefined),
  saveReadingProgress: jest.fn().mockResolvedValue({
    id: 'rp', fileId: 'testFile', location: 'loc', progress: 0, lastReadAt: Date.now()
  }),
  fetchHighlights: jest.fn(),
  saveHighlight: jest.fn().mockImplementation((fileId: string, cfi: string, text: string, color: string) => ({
    id: 'new', fileId, cfiRange: cfi, text, color, createdAt: Date.now()
  })),
  deleteHighlight: jest.fn().mockResolvedValue(undefined),
  updateHighlightNote: jest.fn().mockResolvedValue(undefined),
}));

import * as db from '../db';

// Mock epubjs
const mockAnnotationCallbacks: { [key: string]: (e: MouseEvent) => void } = {};
const mockAnnotations = {
  highlight: jest.fn((cfi: string, _data: any, callback: (e: MouseEvent) => void, _className: string) => {
    mockAnnotationCallbacks[cfi] = callback;
  }),
  remove: jest.fn(),
};

const mockRendition = {
  on: jest.fn((event: string, handler: Function) => {
    if (event === 'displayed') {
      handler();
    }
  }),
  annotations: mockAnnotations,
  display: jest.fn().mockResolvedValue(undefined),
  themes: {
    register: jest.fn(),
    override: jest.fn(),
    fontSize: jest.fn(),
    select: jest.fn(),
  },
  currentLocation: jest.fn().mockReturnValue({ start: { cfi: 'cfi/1' } }),
};

jest.mock('epubjs', () => {
  const EpubMock = jest.fn().mockImplementation(() => ({
    renderTo: jest.fn().mockReturnValue(mockRendition),
    ready: Promise.resolve(),
    locations: {
      generate: jest.fn().mockResolvedValue(undefined),
      locationFromCfi: jest.fn().mockReturnValue(1),
      total: 10,
      percentageFromCfi: jest.fn().mockReturnValue(0.1),
    },
    destroy: jest.fn(),
  }));
  return EpubMock;
});

describe('EpubViewer Highlight Logic', () => {
  const mockHighlights = [
    { id: '1', fileId: 'f', cfiRange: 'cfi/1', text: 'Highlight 1', note: '', color: 'yellow', createdAt: Date.now() },
    { id: '2', fileId: 'f', cfiRange: 'cfi/2', text: 'Highlight 2', note: '', color: 'yellow', createdAt: Date.now() },
  ];

  beforeEach(() => {
    (db.fetchHighlights as jest.Mock).mockResolvedValue(mockHighlights);
    jest.clearAllMocks();
  });

  afterEach(() => {
    // no-op
  });

  async function renderViewer() {
    await act(async () => {
      render(
        <EpubViewer
          fileId="testFile"
          fileUrl="testUrl"
          fileName="Test Book"
          onClose={() => {}}
        />
      );
    });
    // wait until initial highlights have been registered
    await waitFor(() => expect(mockAnnotations.highlight).toHaveBeenCalledTimes(mockHighlights.length));
  }

  it('toggles a highlight active and inactive', async () => {
    await renderViewer();

    // Activate Highlight 1
    await act(async () => {
      const clickEvent = new MouseEvent('click', { bubbles: true });
      mockAnnotationCallbacks['cfi/1'](clickEvent);
    });
    await waitFor(() =>
      expect(mockAnnotations.highlight).toHaveBeenCalledWith('cfi/1', {}, expect.any(Function), 'hl-active')
    );

    // Deactivate Highlight 1
    await act(async () => {
      const clickEvent = new MouseEvent('click', { bubbles: true });
      mockAnnotationCallbacks['cfi/1'](clickEvent);
    });
    await waitFor(() =>
      expect(mockAnnotations.highlight).toHaveBeenCalledWith('cfi/1', {}, expect.any(Function), 'hl')
    );
  });

  it('switches active highlight from one to another', async () => {
    await renderViewer();

    // Activate Highlight 1
    await act(async () => {
      const clickEvent = new MouseEvent('click', { bubbles: true });
      mockAnnotationCallbacks['cfi/1'](clickEvent);
    });
    await waitFor(() =>
      expect(mockAnnotations.highlight).toHaveBeenCalledWith('cfi/1', {}, expect.any(Function), 'hl-active')
    );

    // Activate Highlight 2 (should deactivate 1)
    await act(async () => {
      const clickEvent = new MouseEvent('click', { bubbles: true });
      mockAnnotationCallbacks['cfi/2'](clickEvent);
    });
    await waitFor(() =>
      expect(mockAnnotations.highlight).toHaveBeenCalledWith('cfi/1', {}, expect.any(Function), 'hl')
    );
    await waitFor(() =>
      expect(mockAnnotations.highlight).toHaveBeenCalledWith('cfi/2', {}, expect.any(Function), 'hl-active')
    );
  });
});
