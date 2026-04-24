import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB, deleteDB } from 'idb';

const mockPostMessage = vi.fn();
globalThis.postMessage = mockPostMessage;
globalThis.self = globalThis as any;

describe('importWorker component', () => {
  beforeEach(async () => {
    mockPostMessage.mockClear();
    await deleteDB('InventoryImportDB');
    await import('./importWorker');
  });

  it('correctly parses valid JSON and buffers it into IndexedDB', async () => {
    const validData = {
      pages: ['Page1'],
      activePage: 'Page1',
      pageConfigs: {},
      pageRows: {},
      globalCopyBoxes: {
        enabled: true,
        box1: { sourcePage: '', sourceColumn: '' },
        box2: { sourcePage: '', sourceColumn: '' },
        separator: '-',
        order: ['box1', 'box2', 'box3']
      }
    };
    
    const file = new File([JSON.stringify(validData)], 'backup.json', { type: 'application/json' });
    
    // Trigger message event
    await (globalThis as any).onmessage({ data: { file } });

    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'progress', message: 'Reading file...', percent: 10 });
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'progress', message: 'Parsing data...', percent: 30 });
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'progress', message: 'Buffering in IndexedDB...', percent: 80 });
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'progress', message: 'Syncing with backend...', percent: 95 });
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'success' });

    // Verify it buffered properly
    const db = await openDB('InventoryImportDB', 1);
    const buffered = await db.get('import_buffer', 'latest_import');
    expect(buffered.pages).toEqual(['Page1']);
    expect(buffered.activePage).toEqual('Page1');
    expect(buffered.globalCopyBoxes.enabled).toBe(true);
    db.close();
  });

  it('throws an error for invalid JSON', async () => {
    const file = new Blob(['{ invalid_json'], { type: 'application/json' });
    
    await (globalThis as any).onmessage({ data: { file } });
    
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'error',
      error: expect.stringContaining('Expected property name')
    });
  });

  it('throws an error for missing pages array', async () => {
    const invalidData = {
      notPages: []
    };
    
    const file = new Blob([JSON.stringify(invalidData)], { type: 'application/json' });
    
    await (globalThis as any).onmessage({ data: { file } });
    
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'error',
      error: 'Invalid backup file format'
    });
  });

  it('sets activePage to first page if missing but pages exist', async () => {
    const dataWithoutActivePage = {
      pages: ['Page2', 'Page3'],
      pageConfigs: {},
      pageRows: {}
    };
    
    const file = new Blob([JSON.stringify(dataWithoutActivePage)], { type: 'application/json' });
    
    await (globalThis as any).onmessage({ data: { file } });
    
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'success' });
    
    const db = await openDB('InventoryImportDB', 1);
    const buffered = await db.get('import_buffer', 'latest_import');
    expect(buffered.activePage).toEqual('Page2');
    db.close();
  });

  it('sets default globalCopyBoxes if missing', async () => {
    const dataWithoutBoxes = {
      pages: ['Page1'],
    };
    const file = new Blob([JSON.stringify(dataWithoutBoxes)], { type: 'application/json' });
    
    await (globalThis as any).onmessage({ data: { file } });
    
    const db = await openDB('InventoryImportDB', 1);
    const buffered = await db.get('import_buffer', 'latest_import');
    
    expect(buffered.globalCopyBoxes).toBeDefined();
    expect(buffered.globalCopyBoxes.enabled).toBe(true);
    expect(buffered.globalCopyBoxes.box1).toEqual({ sourcePage: '', sourceColumn: '' });
    db.close();
  });
});
