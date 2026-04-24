import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import 'fake-indexeddb/auto';
import { openDB } from 'idb';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const mockWorker = {
  postMessage: vi.fn(),
  terminate: vi.fn(),
  onmessage: null as any,
};

// Mock the Worker globally
globalThis.Worker = class {
  onmessage: any;
  constructor() {
    return mockWorker;
  }
} as any;

import App from './App';

describe('App Import Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation(async (url) => {
      if (url === '/api/state') {
        return { ok: true, json: async () => ({ pages: [] }) };
      }
      return { ok: true, json: async () => ({}) };
    });
  });

  it('triggers sync via /api/state when Worker finishes successfully', async () => {
    render(<App />);

    // Simulate file selection
    // wait for initial API calls to resolve
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/state');
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const file = new File(['{}'], 'backup.json', { type: 'application/json' });
    
    // Create DB directly to mock what the worker does
    const db = await openDB('InventoryImportDB', 1, {
      upgrade(db) {
        db.createObjectStore('import_buffer');
      }
    });
    
    const mockState = { pages: ['TestPage'], activePage: 'TestPage' };
    await db.put('import_buffer', mockState, 'latest_import');
    db.close();

    // Trigger file select
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Expect worker to have been created and postMessage called
    expect(mockWorker.postMessage).toHaveBeenCalled();

    // Clear fetch mocks to only capture the PUT request during sync
    mockFetch.mockClear();

    // Simulate worker responding with success
    mockWorker.onmessage({ data: { type: 'success' } });

    // Assuming the App then reads from IDB and posts to /api/state
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/state', expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockState)
      }));
    });
    
    await waitFor(() => {
      expect(mockWorker.terminate).toHaveBeenCalled();
    });
  });
});
