import { openDB } from 'idb';

self.onmessage = async (e) => {
  const { file } = e.data;
  
  try {
    postMessage({ type: 'progress', message: 'Reading file...', percent: 10 });
    const text = await file.text();
    
    postMessage({ type: 'progress', message: 'Parsing data...', percent: 30 });
    const parsed = JSON.parse(text);
    
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

    if (parsed.pageRows) {
      const pageNames = Object.keys(parsed.pageRows);
      let totalRows = 0;
      for (const p of pageNames) {
        totalRows += Array.isArray(parsed.pageRows[p]) ? parsed.pageRows[p].length : 0;
      }
      
      let processed = 0;
      if (totalRows > 0) {
        for (const p of pageNames) {
          const rows = parsed.pageRows[p];
          if (Array.isArray(rows)) {
            for (let i = 0; i < rows.length; i++) {
              processed++;
              if (processed % 1000 === 0) {
                 const pct = Math.floor(30 + (processed / totalRows) * 50);
                 postMessage({ type: 'progress', message: `Processing rows (${processed}/${totalRows})...`, percent: pct });
                 await new Promise(resolve => setTimeout(resolve, 0));
              }
            }
          }
        }
      }
    }

    postMessage({ type: 'progress', message: 'Buffering in IndexedDB...', percent: 80 });
    const db = await openDB('InventoryImportDB', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('import_buffer')) {
          db.createObjectStore('import_buffer');
        }
      },
    });

    await db.put('import_buffer', parsed, 'latest_import');
    db.close();
    
    postMessage({ type: 'progress', message: 'Syncing with backend...', percent: 95 });
    postMessage({ type: 'success' });
  } catch (error: any) {
    postMessage({ type: 'error', error: error.message || 'Unknown error' });
  }
};
