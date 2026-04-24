import { openDB } from 'idb';

self.onmessage = async (e) => {
  const { file } = e.data;
  
  try {
    postMessage({ type: 'progress', message: 'Reading file...' });
    const text = await file.text();
    
    postMessage({ type: 'progress', message: 'Parsing data...' });
    const parsed = JSON.parse(text);
    
    postMessage({ type: 'progress', message: 'Buffering in IndexedDB...' });
    const db = await openDB('InventoryImportDB', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('import_buffer')) {
          db.createObjectStore('import_buffer');
        }
      },
    });
    
    // Quick validation
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.pages)) {
      throw new Error("Invalid backup file format");
    }

    if (parsed.pages.length > 0 && !parsed.activePage) {
      parsed.activePage = parsed.pages[0];
    }
    
    if (!parsed.globalCopyBoxes) {
      parsed.globalCopyBoxes = {
        enabled: true,
        box1: { sourcePage: '', sourceColumn: '' },
        box2: { sourcePage: '', sourceColumn: '' },
        separator: '-',
        order: ['box1', 'box2', 'box3']
      };
    } else if (typeof parsed.globalCopyBoxes.enabled !== 'boolean') {
      parsed.globalCopyBoxes.enabled = true;
    }

    await db.put('import_buffer', parsed, 'latest_import');
    
    postMessage({ type: 'success' });
  } catch (error: any) {
    postMessage({ type: 'error', error: error.message || 'Unknown error' });
  }
};
