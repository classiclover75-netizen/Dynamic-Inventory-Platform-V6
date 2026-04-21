import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '1000mb' }));
app.use(express.urlencoded({ limit: '1000mb', extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));

// MongoDB Connection with Retry
let isUsingMongoDB = false;

const connectDB = async () => {
  // 1. Clean the URI (remove extra quotes or spaces)
  let rawUri = process.env.MONGODB_URI;
  if (rawUri) {
    rawUri = rawUri.replace(/^["']|["']$/g, '').trim();
  }

  // 2. Determine final URI
  const uri = rawUri || (process.env.NODE_ENV === 'production' ? 'mongodb://db:27017/inventory' : '');

  // 3. Fallback check for AI Studio / Local Preview
  if (!uri || (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://'))) {
    console.warn('No valid MONGODB_URI found (Invalid scheme or empty). Using local file storage fallback for preview.');
    return;
  }

  // 4. Connection Loop
  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
      console.log('Connected to MongoDB');
      isUsingMongoDB = true;
      return;
    } catch (err: any) {
      retries++;
      console.error(`MongoDB connection attempt ${retries} failed. ${err.message}`);
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  console.warn('Could not connect to MongoDB after retries. Falling back to local file storage for preview.');
};
connectDB();

// Local Storage Fallback Logic
const LOCAL_DB_PATH = path.join(process.cwd(), 'db.json');

async function getLocalDB() {
  try {
    const data = await fs.promises.readFile(LOCAL_DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { pages: [], settings: {} };
  }
}

async function saveLocalDB(data: any) {
  await fs.promises.writeFile(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
}

// Image Helpers
function processRowImages(row: any) {
  const newRow = { ...row };
  for (const key in newRow) {
    const value = newRow[key];
    let base64String = null;
    if (typeof value === 'string' && value.startsWith('data:image/')) {
      base64String = value;
    } else if (typeof value === 'object' && value !== null && typeof value.data === 'string' && value.data.startsWith('data:image/')) {
      base64String = value.data;
    }
    if (base64String && base64String.includes(';base64,')) {
      try {
        const parts = base64String.split(';base64,');
        const mimeType = parts[0].replace('data:image/', '');
        let ext = mimeType.split('+')[0];
        if (ext === 'jpeg') ext = 'jpg';
        if (!ext) ext = 'png';
        const base64Data = parts[1];
        const filename = `${uuidv4()}.${ext}`;
        const filepath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(filepath, base64Data, 'base64');
        newRow[key] = filename;
      } catch (err) {
        console.error("Failed to process image:", err);
      }
    }
  }
  return newRow;
}

function cleanupOrphanImages(oldRows: any[], newRows: any[]) {
  const oldFiles = new Set<string>();
  const newFiles = new Set<string>();
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

  const extractFiles = (rows: any[], set: Set<string>) => {
    rows.forEach(row => {
      Object.values(row).forEach(val => {
        if (typeof val === 'string' && imageExtensions.some(ext => val.toLowerCase().endsWith(ext))) {
          set.add(val);
        }
      });
    });
  };

  extractFiles(oldRows, oldFiles);
  extractFiles(newRows, newFiles);

  oldFiles.forEach(file => {
    if (!newFiles.has(file)) {
      try {
        const filepath = path.join(UPLOADS_DIR, file);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      } catch (err) {
        console.error(`Failed to delete orphaned image ${file}:`, err);
      }
    }
  });
}

// Mongoose Schema
const pageSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  config: { type: mongoose.Schema.Types.Mixed, default: {} }
});
const Page = mongoose.model('Page', pageSchema);

const pageRowSchema = new mongoose.Schema({
  pageName: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true }
});
const PageRow = mongoose.model('PageRow', pageRowSchema);

const settingsSchema = new mongoose.Schema({
  globalCopyBoxes: mongoose.Schema.Types.Mixed,
  globalRowNoWidth: Number,
  maxSearchHistory: { type: Number, default: 10 }
});
const AppSettings = mongoose.model('AppSettings', settingsSchema);

// API Routes
function embedImagesInRows(rows: any[]) {
  return rows.map(row => {
    const newRow = { ...row };
    for (const key in newRow) {
      const val = newRow[key];
      if (typeof val === 'string' && /\.(png|jpe?g|gif|webp)$/i.test(val)) {
        try {
          const filepath = path.join(UPLOADS_DIR, val);
          if (fs.existsSync(filepath)) {
            const ext = path.extname(val).substring(1).toLowerCase();
            const mimeType = ext === 'jpg' ? 'jpeg' : ext;
            const fileData = fs.readFileSync(filepath, { encoding: 'base64' });
            newRow[key] = `data:image/${mimeType};base64,${fileData}`;
          }
        } catch (e) {
          console.error(`Failed to convert image ${val} to base64:`, e);
        }
      }
    }
    return newRow;
  });
}

app.get('/api/export', async (req, res) => {
  try {
    let state: any = {};
    if (isUsingMongoDB) {
      const pages = await Page.find({});
      const rows = await PageRow.find({});
      const settings: any = await AppSettings.findOne() || {};
      
      const pageConfigs: Record<string, any> = {};
      const pageRows: Record<string, any[]> = {};
      
      pages.forEach(p => {
        pageConfigs[p.name] = p.config;
      });
      
      rows.forEach(r => {
        if (!pageRows[r.pageName]) pageRows[r.pageName] = [];
        pageRows[r.pageName].push(r.data);
      });

      // Embed images
      for (const pageName in pageRows) {
        pageRows[pageName] = embedImagesInRows(pageRows[pageName]);
      }
      
      state = {
        pages: pages.map(p => p.name),
        activePage: pages.length > 0 ? pages[0].name : '',
        pageConfigs,
        pageRows,
        globalCopyBoxes: settings.globalCopyBoxes,
        globalRowNoWidth: settings.globalRowNoWidth,
        maxSearchHistory: settings.maxSearchHistory
      };
    } else {
      state = await getLocalDB();
      if (state.pages) {
        state.pages = state.pages.map((page: any) => ({
          ...page,
          rows: embedImagesInRows(page.rows || [])
        }));
      }
    }

    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=inventory_backup_${formattedDate}.json`);
    res.send(JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

app.get('/api/state', async (req, res) => {
  try {
    if (isUsingMongoDB) {
      const pages = await Page.find({}, 'name');
      const settings: any = await AppSettings.findOne() || {};
      
      const state = {
        pages: pages.map(p => p.name),
        globalCopyBoxes: settings.globalCopyBoxes,
        globalRowNoWidth: settings.globalRowNoWidth,
        maxSearchHistory: settings.maxSearchHistory
      };
      
      return res.json(state);
    } else {
      const db = await getLocalDB();
      const state = {
        pages: db.pages.map((p: any) => p.name),
        globalCopyBoxes: db.settings?.globalCopyBoxes,
        globalRowNoWidth: db.settings?.globalRowNoWidth,
        maxSearchHistory: db.settings?.maxSearchHistory
      };
      return res.json(state);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch state' });
  }
});

app.get('/api/pages/:name', async (req, res) => {
  try {
    const { name } = req.params;
    if (isUsingMongoDB) {
      const page = await Page.findOne({ name });
      if (!page) return res.status(404).json({ error: 'Page not found' });
      
      const rows = await PageRow.find({ pageName: name });
      
      return res.json({
        name: page.name,
        config: page.config,
        rows: rows.map(r => r.data)
      });
    } else {
      const db = await getLocalDB();
      const page = db.pages.find((p: any) => p.name === name);
      if (!page) return res.status(404).json({ error: 'Page not found' });
      
      return res.json({
        name: page.name,
        config: page.config,
        rows: page.rows || []
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch page data' });
  }
});

app.post('/api/pages', async (req, res) => {
  try {
    const { name, config } = req.body;
    if (isUsingMongoDB) {
      const newPage = new Page({ name, config });
      await newPage.save();
    } else {
      const db = await getLocalDB();
      db.pages.push({ name, config, rows: [] });
      await saveLocalDB(db);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create page' });
  }
});

app.put('/api/pages/:name/rename', async (req, res) => {
  try {
    const { name } = req.params;
    const { newName } = req.body;
    if (isUsingMongoDB) {
      await Page.findOneAndUpdate({ name }, { name: newName });
      await PageRow.updateMany({ pageName: name }, { pageName: newName });
    } else {
      const db = await getLocalDB();
      const page = db.pages.find((p: any) => p.name === name);
      if (page) page.name = newName;
      await saveLocalDB(db);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to rename page' });
  }
});

app.delete('/api/pages/:name', async (req, res) => {
  try {
    const { name } = req.params;
    if (isUsingMongoDB) {
      const oldPageRows = await PageRow.find({ pageName: name });
      cleanupOrphanImages(oldPageRows.map(r => r.data), []);
      await Page.findOneAndDelete({ name });
      await PageRow.deleteMany({ pageName: name });
    } else {
      const db = await getLocalDB();
      const page = db.pages.find((p: any) => p.name === name);
      if (page) {
        cleanupOrphanImages(page.rows || [], []);
        db.pages = db.pages.filter((p: any) => p.name !== name);
      }
      await saveLocalDB(db);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete page' });
  }
});

app.put('/api/pageConfigs/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { config } = req.body;
    if (isUsingMongoDB) {
      await Page.findOneAndUpdate({ name }, { config });
    } else {
      const db = await getLocalDB();
      const page = db.pages.find((p: any) => p.name === name);
      if (page) page.config = config;
      await saveLocalDB(db);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update config' });
  }
});

app.put('/api/pageRows/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { rows } = req.body;
    if (isUsingMongoDB) {
      const oldPageRows = await PageRow.find({ pageName: name });
      const oldRows = oldPageRows.map(r => r.data);
      const newRows = (rows || []).map(processRowImages);
      
      cleanupOrphanImages(oldRows, newRows);
      
      await PageRow.deleteMany({ pageName: name });
      if (newRows.length > 0) {
        await PageRow.insertMany(newRows.map((row: any) => ({ pageName: name, data: row })));
      }
    } else {
      const db = await getLocalDB();
      const page = db.pages.find((p: any) => p.name === name);
      if (page) {
        const oldRows = page.rows || [];
        const newRows = (rows || []).map(processRowImages);
        cleanupOrphanImages(oldRows, newRows);
        page.rows = newRows;
      }
      await saveLocalDB(db);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update rows' });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const { globalCopyBoxes, globalRowNoWidth, maxSearchHistory } = req.body;
    if (isUsingMongoDB) {
      await AppSettings.findOneAndUpdate({}, { globalCopyBoxes, globalRowNoWidth, maxSearchHistory }, { upsert: true });
    } else {
      const db = await getLocalDB();
      db.settings = { globalCopyBoxes, globalRowNoWidth, maxSearchHistory };
      await saveLocalDB(db);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

app.put('/api/state', async (req, res) => {
  try {
    const newState = req.body;
    
    // Process all images in the new state
    const processedPageRows: Record<string, any[]> = {};
    if (newState.pageRows) {
      for (const pageName in newState.pageRows) {
        processedPageRows[pageName] = newState.pageRows[pageName].map(processRowImages);
      }
    }

    if (isUsingMongoDB) {
      // Fetch all existing rows to cleanup images
      const allOldPageRows = await PageRow.find({});
      const allOldRows = allOldPageRows.map(r => r.data);
      
      const allNewRows: any[] = [];
      for (const pageName in processedPageRows) {
        allNewRows.push(...processedPageRows[pageName]);
      }
      
      cleanupOrphanImages(allOldRows, allNewRows);

      // Clear existing data
      await Page.deleteMany({});
      await PageRow.deleteMany({});
      await AppSettings.deleteMany({});
      
      // Insert new pages (without rows)
      const pagesToInsert = newState.pages.map((name: string) => ({
        name,
        config: newState.pageConfigs[name] || {}
      }));
      
      if (pagesToInsert.length > 0) {
        await Page.insertMany(pagesToInsert);
      }

      // Insert all rows
      const allRowsToInsert: any[] = [];
      newState.pages.forEach((pageName: string) => {
        const rows = processedPageRows[pageName] || [];
        rows.forEach((row: any) => {
          allRowsToInsert.push({ pageName, data: row });
        });
      });

      if (allRowsToInsert.length > 0) {
        await PageRow.insertMany(allRowsToInsert);
      }
      
      // Update settings
      await AppSettings.findOneAndUpdate({}, {
        globalCopyBoxes: newState.globalCopyBoxes,
        globalRowNoWidth: newState.globalRowNoWidth,
        maxSearchHistory: newState.maxSearchHistory
      }, { upsert: true });
    } else {
      const db = await getLocalDB();
      const allOldRows: any[] = [];
      db.pages.forEach((p: any) => {
        if (p.rows) allOldRows.push(...p.rows);
      });

      const allNewRows: any[] = [];
      for (const pageName in processedPageRows) {
        allNewRows.push(...processedPageRows[pageName]);
      }
      cleanupOrphanImages(allOldRows, allNewRows);

      const newDb = {
        pages: newState.pages.map((name: string) => ({
          name,
          config: newState.pageConfigs[name] || {},
          rows: processedPageRows[name] || []
        })),
        settings: {
          globalCopyBoxes: newState.globalCopyBoxes,
          globalRowNoWidth: newState.globalRowNoWidth,
          maxSearchHistory: newState.maxSearchHistory
        }
      };
      await saveLocalDB(newDb);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Bulk sync error:', err);
    res.status(500).json({ error: 'Failed to sync state' });
  }
});

// Vite Middleware for Development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
