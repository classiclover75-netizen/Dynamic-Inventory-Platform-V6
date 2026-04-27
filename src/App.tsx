import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Settings, Plus, X, Edit, Trash2, Copy, Image as ImageIcon, RefreshCw, GripVertical, ArrowUp, ArrowDown, Lock, Unlock, Undo2, Redo2, History } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button, Input, Modal } from './components/ui';
import { ToastProvider, useToast } from './components/ToastProvider';
import { CopyPopupNotification } from './components/CopyPopupNotification';
import { CreatePageModal } from './components/CreatePageModal';
import { AddRowModal } from './components/AddRowModal';
import { ActivePageSettingsModal } from './components/ActivePageSettingsModal';
import { RenamePageModal } from './components/RenamePageModal';
import { CreateColumnModal } from './components/CreateColumnModal';
import { EditColumnModal } from './components/EditColumnModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { ReorderPagesModal } from './components/ReorderPagesModal';
import { ReorderSearchBarsModal } from './components/ReorderSearchBarsModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { ExcelExportModal } from './components/ExcelExportModal';
import { DuplicateFinderModal } from './components/DuplicateFinderModal';
import { GlobalCombinationCopyBoxes } from './components/GlobalCombinationCopyBoxes';
import { GlobalCopyBoxesSettingsModal } from './components/GlobalCopyBoxesSettingsModal';
import { RowNoResizeModal } from './components/RowNoResizeModal';
import { AppState, Column, PageConfig, RowData, GlobalCopyBoxesSettings } from './types';

const initialConfig: PageConfig = {
  rowReorderEnabled: false,
  hoverPreviewEnabled: false,
  columns: [
    { key: 'sr', name: 'Row No.', type: 'system_serial', locked: true, movable: false }
  ]
};

const decodeHtmlEntities = (text: string) => {
  if (!text) return text;
  return String(text)
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
};

const renderHighlightedText = (text: string, highlight: string) => {
  if (!highlight.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() 
          ? <span key={i} className="bg-yellow-200 text-black px-1 rounded font-bold">{part}</span> 
          : part
      )}
    </>
  );
};

function AppContent() {
  const [state, setState] = useState<AppState>({
    pages: [],
    activePage: '',
    pageConfigs: {},
    pageRows: {},
    globalRowNoWidth: 100
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [clearDBModal, setClearDBModal] = useState({ isOpen: false, step: 1, yesLeft: true });
  const [maxSearchHistory, setMaxSearchHistory] = useState(10);
  const [showHistoryLimitModal, setShowHistoryLimitModal] = useState(false);
  const [tempHistoryLimit, setTempHistoryLimit] = useState(10);

  const [localSettings, setLocalSettings] = useState({ ghostHighlight: false });

  useEffect(() => {
    const saved = localStorage.getItem('inventory_local_settings');
    if (saved) {
      setLocalSettings(JSON.parse(saved));
    }
  }, []);

  const handleUpdateLocalSetting = (key: 'ghostHighlight', value: boolean) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    localStorage.setItem('inventory_local_settings', JSON.stringify(newSettings));
    toast(`${key} updated for this device`);
  };

  const handleClearEntireDB = async () => {
    const emptyState = {
      pages: [],
      pageConfigs: {},
      pageRows: {},
      globalRowNoWidth: state.globalRowNoWidth
    };
    try {
      await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emptyState)
      });
      toast('Database cleared completely!');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      console.error(err);
      toast('Failed to clear database');
    }
  };

  const getImageUrl = (val: any) => {
    if (!val) return '';
    const imgData = typeof val === 'object' && val !== null ? val.data : val;
    if (!imgData) return '';
    if (typeof imgData === 'string' && (imgData.startsWith('data:image') || /^https?:\/\//i.test(imgData))) {
      return imgData;
    }
    return `/uploads/${imgData}`;
  };

  const hoveredCellRef = useRef<HTMLTableCellElement | null>(null);

  useEffect(() => {
    fetch('/api/state')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setState(prev => ({
            ...prev,
            pages: data.pages || [],
            globalRowNoWidth: data.globalRowNoWidth || prev.globalRowNoWidth,
            activePage: data.pages && data.pages.length > 0 && !prev.activePage ? data.pages[0] : prev.activePage
          }));
          if (data.maxSearchHistory) setMaxSearchHistory(data.maxSearchHistory);
        }
      })
      .catch(err => console.error('Failed to fetch initial state:', err))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!state.activePage) return;

    const fetchPageData = async (pageName: string) => {
      try {
        const res = await fetch(`/api/pages/${encodeURIComponent(pageName)}`);
        const data = await res.json();
        if (data && !data.error) {
          setState(prev => ({
            ...prev,
            pageConfigs: {
              ...prev.pageConfigs,
              [data.name]: data.config
            },
            pageRows: {
              ...prev.pageRows,
              [data.name]: data.rows
            }
          }));
          return data.config;
        }
      } catch (err) {
        console.error('Failed to fetch page data:', err);
      }
      return null;
    };

    const loadData = async () => {
      let activeConfig = state.pageConfigs[state.activePage];
      
      if (!activeConfig) {
        setIsLoading(true);
        activeConfig = await fetchPageData(state.activePage);
      }

      if (activeConfig && activeConfig.secondarySearchPage && !state.pageConfigs[activeConfig.secondarySearchPage]) {
        setIsLoading(true);
        await fetchPageData(activeConfig.secondarySearchPage);
      }
      
      setIsLoading(false);
    };

    const activeConfig = state.pageConfigs[state.activePage];
    if (!activeConfig || (activeConfig.secondarySearchPage && !state.pageConfigs[activeConfig.secondarySearchPage])) {
      loadData();
    }
  }, [state.activePage, state.pageConfigs]);

  const applyHover = (td: HTMLTableCellElement) => {
    const tr = td.parentElement as HTMLTableRowElement;
    if (!tr) return;
    const table = tr.closest('table');
    if (!table) return;

    const cellIndex = td.cellIndex;
    
    td.dataset.hoveredExact = 'true';
    
    const cellsInRow = tr.children;
    for (let i = 0; i < cellsInRow.length; i++) {
      const cell = cellsInRow[i] as HTMLTableCellElement;
      cell.dataset.hoveredRow = 'true';
    }
    
    const rows = table.rows;
    for (let i = 0; i < rows.length; i++) {
      const cellInCol = rows[i].children[cellIndex] as HTMLTableCellElement;
      if (cellInCol) {
        cellInCol.dataset.hoveredCol = 'true';
      }
    }
  };

  const cleanupHover = (td: HTMLTableCellElement) => {
    const root = td.closest('table') || document;
    
    const exacts = root.querySelectorAll('[data-hovered-exact]');
    for (let i = 0; i < exacts.length; i++) {
      delete (exacts[i] as HTMLElement).dataset.hoveredExact;
    }
    
    const rows = root.querySelectorAll('[data-hovered-row]');
    for (let i = 0; i < rows.length; i++) {
      delete (rows[i] as HTMLElement).dataset.hoveredRow;
    }
    
    const cols = root.querySelectorAll('[data-hovered-col]');
    for (let i = 0; i < cols.length; i++) {
      delete (cols[i] as HTMLElement).dataset.hoveredCol;
    }
  };

  const handleTableMouseOver = (e: React.MouseEvent<HTMLTableElement>) => {
    const td = (e.target as HTMLElement).closest('td, th') as HTMLTableCellElement;
    if (!td) return;
    
    if (hoveredCellRef.current === td) return;
    
    if (hoveredCellRef.current) {
      cleanupHover(hoveredCellRef.current);
    }
    
    hoveredCellRef.current = td;
    applyHover(td);
  };

  const handleTableMouseOut = (e: React.MouseEvent<HTMLTableElement>) => {
    const td = (e.target as HTMLElement).closest('td, th') as HTMLTableCellElement;
    if (!td) return;
    
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (td.contains(relatedTarget)) return;
    
    if (hoveredCellRef.current === td) {
      cleanupHover(td);
      hoveredCellRef.current = null;
    }
  };
  const [activePopupId, setActivePopupId] = useState<string | null>(null);
  const [activeAnchor, setActiveAnchor] = useState<HTMLElement | null>(null);

  const [pageSearchQueries, setPageSearchQueries] = useState<Record<string, string>>({});
  const [primarySearchTags, setPrimarySearchTags] = useState<string[]>([]);
  const [secondarySearchTags, setSecondarySearchTags] = useState<string[]>([]);
  const currentSearch = pageSearchQueries[state.activePage] || '';
  const [secondarySearchQuery, setSecondarySearchQuery] = useState('');
  const [activeSearchView, setActiveSearchView] = useState<'primary' | 'secondary'>('primary');
  const [showTopSettings, setShowTopSettings] = useState(false);
  const [isDupModalOpen, setIsDupModalOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const primaryInputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);

  type HistoryEntry = { value: string; timestamp: number };
  const [primarySearchInput, setPrimarySearchInput] = useState('');
  const [secondarySearchInput, setSecondarySearchInput] = useState('');

  const [primHist, setPrimHist] = useState<{entries: HistoryEntry[], pointer: number}>({ entries: [{ value: '', timestamp: Date.now() }], pointer: 0 });
  const [showPrimHist, setShowPrimHist] = useState(false);
  const primHistRef = useRef<HTMLDivElement>(null);
  const isPrimUndoRef = useRef(false);

  const [secHist, setSecHist] = useState<{entries: HistoryEntry[], pointer: number}>({ entries: [{ value: '', timestamp: Date.now() }], pointer: 0 });
  const [showSecHist, setShowSecHist] = useState(false);
  const secHistRef = useRef<HTMLDivElement>(null);
  const isSecUndoRef = useRef(false);

  const activeSecPage = state.pageConfigs[state.activePage]?.secondarySearchPage;

  useEffect(() => {
    const pVal = pageSearchQueries[state.activePage] || '';
    const sVal = activeSecPage ? (pageSearchQueries[activeSecPage] || '') : '';
    setPrimarySearchInput(pVal);
    setSecondarySearchInput(sVal);
    setActiveSearchView('primary');
    setPrimHist({ entries: [{ value: pVal, timestamp: Date.now() }], pointer: 0 });
    setSecHist({ entries: [{ value: sVal, timestamp: Date.now() }], pointer: 0 });
  }, [state.activePage, activeSecPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPageSearchQueries(prev => prev[state.activePage] === primarySearchInput ? prev : { ...prev, [state.activePage]: primarySearchInput });
    }, 300);
    return () => clearTimeout(timer);
  }, [primarySearchInput, state.activePage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSecondarySearchQuery(secondarySearchInput);
      if (activeSecPage) setPageSearchQueries(prev => prev[activeSecPage] === secondarySearchInput ? prev : { ...prev, [activeSecPage]: secondarySearchInput });
    }, 300);
    return () => clearTimeout(timer);
  }, [secondarySearchInput, activeSecPage]);

  useEffect(() => {
    if (isPrimUndoRef.current) { isPrimUndoRef.current = false; return; }
    const timer = setTimeout(() => {
      setPrimHist(prev => {
        if (prev.entries[prev.pointer]?.value === primarySearchInput) return prev;
        const newEntries = [...prev.entries.slice(0, prev.pointer + 1), { value: primarySearchInput, timestamp: Date.now() }];
        while (newEntries.length > maxSearchHistory) newEntries.shift();
        return { entries: newEntries, pointer: newEntries.length - 1 };
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [primarySearchInput, maxSearchHistory]);

  useEffect(() => {
    if (isSecUndoRef.current) { isSecUndoRef.current = false; return; }
    const timer = setTimeout(() => {
      setSecHist(prev => {
        if (prev.entries[prev.pointer]?.value === secondarySearchInput) return prev;
        const newEntries = [...prev.entries.slice(0, prev.pointer + 1), { value: secondarySearchInput, timestamp: Date.now() }];
        while (newEntries.length > maxSearchHistory) newEntries.shift();
        return { entries: newEntries, pointer: newEntries.length - 1 };
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [secondarySearchInput, maxSearchHistory]);

  const formatHistDate = (ts: number) => {
    const d = new Date(ts);
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).replace(/\s/g, '-');
    const date = `${d.getDate()}-${d.toLocaleString('en-US', { month: 'long' })}-${d.getFullYear()}`;
    return `${time}, ${date}`;
  };

  const handlePrimUndo = () => setPrimHist(prev => { if (prev.pointer > 0) { isPrimUndoRef.current = true; setPrimarySearchInput(prev.entries[prev.pointer - 1].value); return { ...prev, pointer: prev.pointer - 1 }; } return prev; });
  const handlePrimRedo = () => setPrimHist(prev => { if (prev.pointer < prev.entries.length - 1) { isPrimUndoRef.current = true; setPrimarySearchInput(prev.entries[prev.pointer + 1].value); return { ...prev, pointer: prev.pointer + 1 }; } return prev; });
  const handleSecUndo = () => setSecHist(prev => { if (prev.pointer > 0) { isSecUndoRef.current = true; setSecondarySearchInput(prev.entries[prev.pointer - 1].value); return { ...prev, pointer: prev.pointer - 1 }; } return prev; });
  const handleSecRedo = () => setSecHist(prev => { if (prev.pointer < prev.entries.length - 1) { isSecUndoRef.current = true; setSecondarySearchInput(prev.entries[prev.pointer + 1].value); return { ...prev, pointer: prev.pointer + 1 }; } return prev; });

  const handleAddPrimaryTag = () => {
    if (primarySearchInput.trim()) {
      setPrimarySearchTags(prev => [...prev, primarySearchInput.trim()]);
      setPrimarySearchInput('');
    }
  };

  const handleRemovePrimaryTag = (index: number) => {
    setPrimarySearchTags(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddSecondaryTag = () => {
    if (secondarySearchInput.trim()) {
      setSecondarySearchTags(prev => [...prev, secondarySearchInput.trim()]);
      setSecondarySearchInput('');
    }
  };

  const handleRemoveSecondaryTag = (index: number) => {
    setSecondarySearchTags(prev => prev.filter((_, i) => i !== index));
  };

  const handlePrimKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddPrimaryTag();
    }
    if (e.key === 'Backspace' && primarySearchInput === '') setPrimarySearchTags(prev => prev.slice(0, -1));
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.shiftKey ? handlePrimRedo() : handlePrimUndo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); handlePrimRedo(); }
  };

  const handleSecKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSecondaryTag();
    }
    if (e.key === 'Backspace' && secondarySearchInput === '') setSecondarySearchTags(prev => prev.slice(0, -1));
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.shiftKey ? handleSecRedo() : handleSecUndo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); handleSecRedo(); }
  };

  const handleClosePopup = React.useCallback(() => {
    setActivePopupId(null);
  }, []);

  const handleExportData = () => {
    window.open("/api/export");
    toast('Export started. Check your downloads.');
  };

  const handleExportPageJson = () => {
    if (!state.activePage) return;
    window.open(`/api/export/page/${encodeURIComponent(state.activePage)}`);
    toast('Page JSON export started. Check your downloads.');
  };

  const handleImportPageJson = async (file: File) => {
    const activePage = state.activePage;
    if (!activePage) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed.rows || !Array.isArray(parsed.rows)) {
        toast('Invalid JSON format: missing rows array');
        return;
      }

      setImportProgress({ message: 'Merging data...', percent: 10 });

      const currentRows = state.pageRows[activePage] || [];
      const pageConfig = state.pageConfigs[activePage];
      const imageCols = pageConfig?.columns.filter(c => c.type === 'image').map(c => c.key) || [];

      const existingRowsMap = new Map(currentRows.map(r => [String(r.id), r]));
      
      const mergedRows = currentRows.map(existingRow => {
        const incomingRow = parsed.rows.find((r: any) => String(r.id) === String(existingRow.id));
        if (incomingRow) {
          const merged = { ...incomingRow };
          for (const colKey of imageCols) {
            if (existingRow[colKey]) {
              merged[colKey] = existingRow[colKey];
            }
          }
          return merged;
        }
        return existingRow;
      });

      const incomingNewRows = parsed.rows.filter((r: any) => !existingRowsMap.has(String(r.id)));
      mergedRows.push(...incomingNewRows);

      setImportProgress({ message: 'Saving changes...', percent: 50 });

      const response = await fetch(`/api/pageRows/${encodeURIComponent(activePage)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: mergedRows })
      });

      if (!response.ok) {
        throw new Error('Failed to update page rows on server');
      }

      setState(prev => ({
        ...prev,
        pageRows: {
          ...prev.pageRows,
          [activePage]: mergedRows
        }
      }));

      setImportProgress({ message: 'Done!', percent: 100 });
      setTimeout(() => setImportProgress({ message: 'Processing...', percent: null }), 2000);
      toast('Page data imported successfully!');

    } catch (error) {
      console.error("Failed to import page json:", error);
      toast('Failed to import JSON file');
      setImportProgress({ message: 'Processing...', percent: null });
    }
  };

  const [importProgress, setImportProgress] = useState<{ message: string, percent: number | null }>({ message: 'Processing...', percent: null });
  const [trackerFilter, setTrackerFilter] = useState<'all' | 'low' | 'zero' | 'high'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [inlineEdit, setInlineEdit] = useState<{id: string, colKey: string, val: string} | null>(null);
  const [isSalePromptOpen, setIsSalePromptOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState("");
  const [customSaleName, setCustomSaleName] = useState("");

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isLargeFile = file.size > 50 * 1024 * 1024; // 50MB
    if (isLargeFile) {
      if (!window.confirm("Large File Warning: This file is very large and may take a few minutes to process. Your browser might become unresponsive during the upload. Continue?")) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setIsImporting(true);
    setImportProgress({ message: 'Starting import...', percent: 0 });
    
    // Create worker dynamically
    const worker = new Worker(new URL('./importWorker.ts', import.meta.url), { type: 'module' });
    
    worker.onmessage = async (e) => {
      const { type, message, error } = e.data;
      
      if (type === 'progress') {
        setImportProgress({ message: message, percent: e.data.percent !== undefined ? e.data.percent : null });
      } else if (type === 'success') {
        setImportProgress({ message: 'Syncing with server...', percent: 100 });
        try {
          const { openDB } = await import('idb');
          const db = await openDB('InventoryImportDB', 1);
          const parsed = await db.get('import_buffer', 'latest_import');
          
          if (!parsed) throw new Error("Could not read from IndexedDB buffer");

          const response = await fetch('/api/state', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed)
          });

          if (response.ok) {
            toast('Data imported successfully');
            await db.delete('import_buffer', 'latest_import');
            db.close();
            setTimeout(() => window.location.reload(), 1000);
          } else {
            toast('Failed to sync with server');
            setIsImporting(false);
          }
        } catch (err) {
          console.error("Sync error:", err);
          toast('Error during server sync');
          setIsImporting(false);
        } finally {
          worker.terminate();
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      } else if (type === 'error') {
        console.error("Worker error:", error);
        toast(error || 'Error analyzing backup file');
        setIsImporting(false);
        worker.terminate();
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    worker.postMessage({ file });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowTopSettings(false);
      }
      if (primHistRef.current && !primHistRef.current.contains(event.target as Node)) setShowPrimHist(false);
      if (secHistRef.current && !secHistRef.current.contains(event.target as Node)) setShowSecHist(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleGlobalUndoPrevent = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y')) {
        const target = e.target as HTMLElement;
        // Block native undo completely if the user is NOT actively focused on an input.
        // This stops background inputs from reverting when clicking on empty space.
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalUndoPrevent, true);
    return () => window.removeEventListener('keydown', handleGlobalUndoPrevent, true);
  }, []);

  // Modals state
  const [modals, setModals] = useState({
    createPage: false,
    addRow: false,
    activePageSettings: false,
    renamePage: false,
    createColumn: false,
    imagePreview: false,
    editColumn: false,
    reorderPages: false,
    reorderSearchBars: false,
    excelImport: false,
    excelExport: false,
    globalCopyBoxesSettings: false,
    rowNoResize: false
  });

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<{ isOpen: boolean, title?: string, message?: string, confirmLabel?: string, onConfirm: () => void } | null>(null);
  const [rowToDelete, setRowToDelete] = useState<string | null>(null);
  const [previewContext, setPreviewContext] = useState<{ rowId: string; imageKey: string; pageName: string } | null>(null);
  const [returnToSettings, setReturnToSettings] = useState(false);
  const [returnToImagePreview, setReturnToImagePreview] = useState(false);
  const [hoveredImage, setHoveredImage] = useState<{ url: string; x: number; y: number } | null>(null);

  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [excelImportData, setExcelImportData] = useState<{ rows: any[], headers: string[] }>({ rows: [], headers: [] });
  const [box1Value, setBox1Value] = useState('');
  const [box2Value, setBox2Value] = useState('');

  useEffect(() => {
    setSelectedRowIds(new Set());
  }, [state.activePage]);

  const handleToggleMagicPasteColumn = (colKey: string) => {
    setState(prev => {
      const pageConfig = prev.pageConfigs[prev.activePage];
      if (!pageConfig) return prev;
      
      const updatedColumns = pageConfig.columns.map(col => 
        col.key === colKey ? { ...col, magicPasteDisabled: !col.magicPasteDisabled } : col
      );
      
      return {
        ...prev,
        pageConfigs: {
          ...prev.pageConfigs,
          [prev.activePage]: {
            ...pageConfig,
            columns: updatedColumns
          }
        }
      };
    });
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const sourceIdx = result.source.index;
    const destIdx = result.destination.index;
    if (sourceIdx === destIdx) return;

    const draggedRowId = result.draggableId;
    const targetPage = state.activePage;
    const rows = [...(state.pageRows[targetPage] || [])];
    const isMultiDrag = selectedRowIds.has(draggedRowId) && selectedRowIds.size > 1;
    let newRows: RowData[] = [];

    if (isMultiDrag) {
      const selectedRows = rows.filter(r => selectedRowIds.has(r.id));
      const remainingRows = rows.filter(r => !selectedRowIds.has(r.id));
      
      let insertIdx = destIdx;
      if (sourceIdx < destIdx) {
         insertIdx = destIdx - selectedRows.length + 1;
      }
      
      remainingRows.splice(insertIdx, 0, ...selectedRows);
      newRows = remainingRows;
    } else {
      const draggedIdx = rows.findIndex(r => r.id === draggedRowId);
      if (draggedIdx === -1) return;

      const [draggedRow] = rows.splice(draggedIdx, 1);
      rows.splice(destIdx, 0, draggedRow);
      newRows = rows;
    }

    try {
      await fetch(`/api/pageRows/${encodeURIComponent(targetPage)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: newRows })
      });

      setState(prev => ({
        ...prev,
        pageRows: {
          ...prev.pageRows,
          [targetPage]: newRows
        }
      }));
    } catch (err) {
      console.error(err);
      toast('Failed to save reordered rows to database');
    }
  };

  const toggleModal = (modal: keyof typeof modals, value: boolean) => {
    setModals(prev => ({ ...prev, [modal]: value }));
  };

  const closeAllModals = () => {
    setModals({
      createPage: false,
      addRow: false,
      activePageSettings: false,
      renamePage: false,
      createColumn: false,
      editColumn: false,
      imagePreview: false,
      reorderPages: false,
      reorderSearchBars: false,
      excelImport: false,
      excelExport: false
    });
    setEditingRowId(null);
    setEditingPageName(null);
    setEditingColumn(null);
    setPreviewContext(null);
    setReturnToSettings(false);
    setReturnToImagePreview(false);
  };

  const activeConfig = state.pageConfigs[state.activePage] || initialConfig;
  const activeRows = state.pageRows[state.activePage] || [];

  const handleCreateTracker = async (sourcePage: string) => {
    const sourceConfig = state.pageConfigs[sourcePage];
    const sourceRows = state.pageRows[sourcePage] || [];
    if (!sourceConfig) return toast("Source page not found!");

    // SMART AUTO-NUMBERING LOGIC
    const baseTrackerName = `${sourcePage} - Live Tracker`;
    let trackerCounter = 1;
    let trackerName = `${baseTrackerName} (${trackerCounter})`;
    
    // Keep increasing the number in brackets if the name already exists
    while (state.pages.includes(trackerName)) {
      trackerCounter++;
      trackerName = `${baseTrackerName} (${trackerCounter})`;
    }
    
    // EXACT COPY of ALL columns, appending only Total and Remaining
    const newColumns = [
      ...sourceConfig.columns,
      { key: 'total_qty', name: 'Total Qty', type: 'number' as const },
      { key: 'remaining_qty', name: 'Remaining Qty', type: 'number' as const, locked: true }
    ];

    const newConfig: PageConfig = {
      ...sourceConfig,
      isTrackerPage: true,
      linkedSourcePage: sourcePage,
      columns: newColumns,
      minStockAlert: 5
    };

    // EXACT COPY of ALL row data, setting total_qty to '0'
    const newRows = sourceRows.map(row => ({
      ...row,
      total_qty: '0' 
    }));

    try {
      await fetch('/api/pages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trackerName, config: newConfig }) });
      await fetch(`/api/pageRows/${encodeURIComponent(trackerName)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: newRows }) });

      setState(prev => ({
        ...prev, pages: [...prev.pages, trackerName], activePage: trackerName,
        pageConfigs: { ...prev.pageConfigs, [trackerName]: newConfig },
        pageRows: { ...prev.pageRows, [trackerName]: newRows }
      }));
      toast(`Tracker "${trackerName}" created with ALL columns!`);
    } catch (err) { 
      console.error(err); 
      toast("Failed to create tracker page"); 
    }
  };

  const handleSyncTracker = async (trackerName: string) => {
    const config = state.pageConfigs[trackerName];
    if (!config || !config.linkedSourcePage) return;
    const sourceRows = state.pageRows[config.linkedSourcePage] || [];
    const trackerRows = state.pageRows[trackerName] || [];
    const trackerKeys = new Set(trackerRows.map(r => r.id));

    const newRowsToAppend: RowData[] = [];
    sourceRows.forEach(row => {
      if (!trackerKeys.has(row.id)) {
        const textCols = state.pageConfigs[config.linkedSourcePage!]?.columns.filter(c => c.type === 'text') || [];
        const itemNameKey = textCols.length > 0 ? textCols[0].key : Object.keys(row).find(k => typeof row[k] === 'string' && k !== 'id') || 'id';
        newRowsToAppend.push({
          id: row.id,
          item_name: row[itemNameKey] || `Item ${row.id}`,
          total_qty: '0'
        });
      }
    });

    if (newRowsToAppend.length > 0) {
      const updatedRows = [...trackerRows, ...newRowsToAppend];
      try {
        await fetch(`/api/pageRows/${encodeURIComponent(trackerName)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: updatedRows })
        });
        setState(prev => ({
          ...prev,
          pageRows: {
            ...prev.pageRows,
            [trackerName]: updatedRows
          }
        }));
        toast(`Synced ${newRowsToAppend.length} new items`);
      } catch (e) {
        toast('Failed to sync new items');
      }
    } else {
      toast('Tracker is already up to date');
    }
  };

  const handleToggleColumnArchive = async (colKey: string, currentStatus: boolean) => {
    if (!activeConfig) return;
    const updatedColumns = activeConfig.columns.map(c => 
      c.key === colKey ? { ...c, archived: !currentStatus } : c
    );
    const updatedConfig = { ...activeConfig, columns: updatedColumns };
    
    try {
      await fetch(`/api/pageConfigs/${encodeURIComponent(state.activePage)}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ config: updatedConfig }) 
      });
      setState(prev => ({ 
        ...prev, 
        pageConfigs: { ...prev.pageConfigs, [state.activePage]: updatedConfig } 
      }));
    } catch (err) { 
      console.error(err); 
      toast("Failed to update archive status"); 
    }
  };

  const handleBulkArchiveToggle = async (hideAll: boolean) => {
    if (!activeConfig) return;
    const updatedColumns = activeConfig.columns.map(c => 
      c.type === 'sale_tracker' ? { ...c, archived: hideAll } : c
    );
    const updatedConfig = { ...activeConfig, columns: updatedColumns };
    
    try {
      await fetch(`/api/pageConfigs/${encodeURIComponent(state.activePage)}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ config: updatedConfig }) 
      });
      setState(prev => ({ 
        ...prev, 
        pageConfigs: { ...prev.pageConfigs, [state.activePage]: updatedConfig } 
      }));
      toast(hideAll ? "All sale columns hidden!" : "All sale columns visible!");
    } catch (err) { 
      console.error(err); 
      toast("Failed to update columns"); 
    }
  };

  const handleAddSaleColumn = async () => {
    if (!customSaleName.trim()) return;
    const newColKey = 'sale_' + Date.now();
    const newCol = { key: newColKey, name: customSaleName, type: 'sale_tracker' as const };
    
    // Find where to insert the new column (before existing sale columns)
    const currentColumns = [...activeConfig.columns];
    const firstSaleIndex = currentColumns.findIndex(c => c.type === 'sale_tracker');
    
    if (firstSaleIndex !== -1) {
      currentColumns.splice(firstSaleIndex, 0, newCol); // Push old columns to the right
    } else {
      currentColumns.push(newCol); // If no sale columns exist yet
    }
    
    const updatedConfig = { ...activeConfig, columns: currentColumns };
    
    try {
      await fetch(`/api/pageConfigs/${encodeURIComponent(state.activePage)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: updatedConfig }) });
      setState(prev => ({ ...prev, pageConfigs: { ...prev.pageConfigs, [state.activePage]: updatedConfig } }));
      setIsSalePromptOpen(false);
      setCustomSaleName("");
      toast(`Sale column "${customSaleName}" added successfully!`);
    } catch (err) { console.error(err); toast("Failed to add sale column"); }
  };

  const handleSaveInlineEdit = async (pageName: string, rowId: string, colKey: string, val: string) => {
    const updatedRows = [...(state.pageRows[pageName] || [])];
    const idx = updatedRows.findIndex(r => r.id === rowId);
    if (idx >= 0) {
      updatedRows[idx] = { ...updatedRows[idx], [colKey]: val };
      setState(prev => ({
        ...prev,
        pageRows: { ...prev.pageRows, [pageName]: updatedRows }
      }));
      try {
        await fetch(`/api/pageRows/${encodeURIComponent(pageName)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: updatedRows })
        });
      } catch (e) {
        toast('Failed to save inline edit');
      }
    }
    setInlineEdit(null);
  };

  const handleCreatePage = async (name: string, columns: Column[]) => {
    const newConfig = {
      rowReorderEnabled: false,
      hoverPreviewEnabled: false,
      columns: [
        { key: 'sr', name: 'Row No.', type: 'system_serial', locked: true, movable: false },
        ...columns
      ]
    };

    try {
      await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, config: newConfig })
      });

      setState(prev => ({
        ...prev,
        pages: [...prev.pages, name],
        activePage: name,
        pageConfigs: {
          ...prev.pageConfigs,
          [name]: newConfig
        },
        pageRows: {
          ...prev.pageRows,
          [name]: []
        }
      }));
      toggleModal('createPage', false);
      toast(`Page "${name}" created. Added: Row No. + ${columns.length} custom column(s).`);
    } catch (err) {
      console.error(err);
      toast('Failed to create page in database');
    }
  };

  const handleRenamePage = async (newName: string) => {
    const oldName = state.activePage;
    try {
      await fetch(`/api/pages/${encodeURIComponent(oldName)}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName })
      });

      setState(prev => {
        const newPages = prev.pages.map(p => p === oldName ? newName : p);
        const newConfigs = { ...prev.pageConfigs };
        const newRows = { ...prev.pageRows };
        
        newConfigs[newName] = newConfigs[oldName];
        delete newConfigs[oldName];
        
        newRows[newName] = newRows[oldName];
        delete newRows[oldName];

        return {
          ...prev,
          pages: newPages,
          activePage: newName,
          pageConfigs: newConfigs,
          pageRows: newRows
        };
      });
      closeAllModals();
      setReturnToSettings(false);
      toast(`Page renamed to: ${newName}`);
    } catch (err) {
      console.error(err);
      toast('Failed to rename page in database');
    }
  };

  const handleDeletePage = async () => {
    const pageToDelete = state.activePage;
    try {
      await fetch(`/api/pages/${encodeURIComponent(pageToDelete)}`, {
        method: 'DELETE'
      });

      setState(prev => {
        const newPages = prev.pages.filter(p => p !== pageToDelete);
        const newConfigs = { ...prev.pageConfigs };
        const newRows = { ...prev.pageRows };
        
        delete newConfigs[pageToDelete];
        delete newRows[pageToDelete];

        return {
          ...prev,
          pages: newPages,
          activePage: newPages.length > 0 ? newPages[0] : '',
          pageConfigs: newConfigs,
          pageRows: newRows
        };
      });
      closeAllModals();
      toast(`Page "${pageToDelete}" deleted`);
    } catch (err) {
      console.error(err);
      toast('Failed to delete page from database');
    }
  };

  const handleClearPageData = async (pageName: string) => {
    try {
      await fetch(`/api/pageRows/${encodeURIComponent(pageName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [] })
      });

      setState(prev => ({
        ...prev,
        pageRows: {
          ...prev.pageRows,
          [pageName]: []
        }
      }));
      toast('All data cleared successfully');
    } catch (err) {
      console.error(err);
      toast('Failed to clear page data');
    }
  };

  const handleSaveActivePageSettings = async (config: PageConfig, closeModal: boolean = true) => {
    try {
      await fetch(`/api/pageConfigs/${encodeURIComponent(state.activePage)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });

      setState(prev => ({
        ...prev,
        pageConfigs: {
          ...prev.pageConfigs,
          [state.activePage]: config
        }
      }));
      if (closeModal) {
        toggleModal('activePageSettings', false);
        toast(`Page settings updated for ${state.activePage}`);
      }
    } catch (err) {
      console.error(err);
      toast('Failed to save page settings to database');
    }
  };

  const handleCreateColumns = async (newColumns: Column[]) => {
    const updatedConfig = {
      ...state.pageConfigs[state.activePage],
      columns: [...state.pageConfigs[state.activePage].columns, ...newColumns]
    };

    try {
      await fetch(`/api/pageConfigs/${encodeURIComponent(state.activePage)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: updatedConfig })
      });

      setState(prev => ({
        ...prev,
        pageConfigs: {
          ...prev.pageConfigs,
          [state.activePage]: updatedConfig
        }
      }));

      closeAllModals();
      setReturnToSettings(false);
      toast(`${newColumns.length} column(s) added to ${state.activePage}`);
    } catch (err) {
      console.error(err);
      toast('Failed to add columns to database');
    }
  };

  const handleEditColumnClick = (col: Column) => {
    setEditingColumn(col);
    setReturnToSettings(true);
    toggleModal('activePageSettings', false);
    toggleModal('editColumn', true);
  };

  const handleSaveEditedColumn = async (updatedCol: Column) => {
    const currentCols = state.pageConfigs[state.activePage].columns;
    const newCols = currentCols.map(c => c.key === updatedCol.key ? updatedCol : c);
    const updatedConfig = {
      ...state.pageConfigs[state.activePage],
      columns: newCols
    };

    try {
      await fetch(`/api/pageConfigs/${encodeURIComponent(state.activePage)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: updatedConfig })
      });

      setState(prev => ({
        ...prev,
        pageConfigs: {
          ...prev.pageConfigs,
          [state.activePage]: updatedConfig
        }
      }));

      closeAllModals();
      setEditingColumn(null);
      setReturnToSettings(false);
      toast(`Column "${updatedCol.name}" updated successfully`);
    } catch (err) {
      console.error(err);
      toast('Failed to update column in database');
    }
  };

  const handleUpdateColumnPreview = (updatedCol: Column) => {
    setState(prev => {
      const currentCols = prev.pageConfigs[state.activePage].columns;
      const newCols = currentCols.map(c => c.key === updatedCol.key ? updatedCol : c);
      return {
        ...prev,
        pageConfigs: {
          ...prev.pageConfigs,
          [state.activePage]: {
            ...prev.pageConfigs[state.activePage],
            columns: newCols
          }
        }
      };
    });
  };

  const handleSaveRows = async (newRows: RowData[], pageName?: string, force = false) => {
    const targetPage = pageName || state.activePage;
    let currentRows = [...(state.pageRows[targetPage] || [])];

    if (editingRowId) {
      const idx = currentRows.findIndex(r => r.id === editingRowId);
      if (idx >= 0) currentRows[idx] = newRows[0];
      else currentRows.push(newRows[0]);
    } else {
      currentRows.push(...newRows);
    }

    try {
      const response = await fetch(`/api/pageRows/${encodeURIComponent(targetPage)}${force ? '?force=true' : ''}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: currentRows })
      });

      if (!response.ok) {
        if (response.status === 400) {
           const data = await response.json();
           if (data.requiresConfirmation) {
              setConfirmationModal({ 
                isOpen: true, 
                title: "Unsupported Image Format", 
                message: data.error, 
                onConfirm: () => handleSaveRows(newRows, pageName, true) 
              });
              return; 
           }
        }
        throw new Error('Database failed to save');
      }

      // Success! Update state
      setState(prev => ({
        ...prev,
        pageRows: {
          ...prev.pageRows,
          [targetPage]: currentRows
        }
      }));

      if (!editingRowId && !force) {
        setPrimarySearchInput('');
        setPrimarySearchTags([]);
        
        setTimeout(() => {
          if (parentRef.current) {
            parentRef.current.scrollTop = parentRef.current.scrollHeight;
          }
        }, 100); 
      }

      const wasEditing = editingRowId;
      toggleModal('addRow', false);
      setEditingRowId(null);

      // Auto-sync trackers
      const linkedTrackers = Object.entries(state.pageConfigs)
        .filter(([name, c]) => (c as PageConfig).linkedSourcePage === targetPage)
        .map(([name]) => name);

      for (const trackerName of linkedTrackers) {
        const trackerConfig = state.pageConfigs[trackerName];
        if (!trackerConfig) continue;
        const trackerRows = [...(state.pageRows[trackerName] || [])];
        let updatedTracker = false;
        
        for (const newRow of newRows) {
          const tIdx = trackerRows.findIndex(r => r.id === newRow.id);
          if (tIdx >= 0 && wasEditing) {
            const existingTrackerRow = trackerRows[tIdx];
            const trackerKeysToKeep = ['total_qty', 'remaining_qty', ...trackerConfig.columns.filter(c => c.type === 'sale_tracker').map(c => c.key)];
            const preservedData: any = {};
            for (const k of trackerKeysToKeep) if (k in existingTrackerRow) preservedData[k] = existingTrackerRow[k];
            trackerRows[tIdx] = { ...newRow, ...preservedData };
            updatedTracker = true;
          } else if (!wasEditing) {
            const textCols = state.pageConfigs[targetPage]?.columns.filter(c => c.type === 'text') || [];
            const itemNameKey = textCols.length > 0 ? textCols[0].key : Object.keys(newRow).find(k => typeof newRow[k] === 'string' && k !== 'id') || 'id';
            trackerRows.push({
               id: newRow.id,
               item_name: newRow[itemNameKey] || `Item ${newRow.id}`,
               total_qty: '0'
            });
            updatedTracker = true;
          }
        }

        if (updatedTracker) {
          await fetch(`/api/pageRows/${encodeURIComponent(trackerName)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: trackerRows })
          });
          setState(prev => ({
            ...prev,
            pageRows: { ...prev.pageRows, [trackerName]: trackerRows }
          }));
        }
      }

      // Jab database se OK aa jaye, tabhi success message show karein
      if (returnToImagePreview) {
        toggleModal('imagePreview', true);
        setReturnToImagePreview(false);
      } else if (returnToSettings) {
        toggleModal('activePageSettings', true);
        setReturnToSettings(false);
      }
      
      toast(wasEditing ? 'Row updated successfully' : `${newRows.length} row(s) added successfully!`);

    } catch (err) {
      console.error('Save Error:', err);
      // Agar database save karne mein fail ho jaye to user ko lal/error alert dein
      toast('❌ Error saving to database! Please try again.', { style: { background: 'red', color: 'white' } });
    }
  };

  const handleDeleteRow = async (rowId: string, pageName?: string) => {
    const targetPage = pageName || state.activePage;
    
    // Safety Verification Check: Force string conversion to prevent strict equality mismatch
    const safeRowId = String(rowId);
    const currentRows = state.pageRows[targetPage] || [];
    const newRows = currentRows.filter(r => String(r.id) !== safeRowId);

    try {
      await fetch(`/api/pageRows/${encodeURIComponent(targetPage)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: newRows })
      });

      setState(prev => ({
        ...prev,
        pageRows: {
          ...prev.pageRows,
          // Safety Check: Double check filtering directly on prev state to avoid stale closures
          [targetPage]: (prev.pageRows[targetPage] || []).filter(r => String(r.id) !== safeRowId)
        }
      }));

      // Auto-sync trackers (delete row)
      const linkedTrackers = Object.entries(state.pageConfigs)
        .filter(([name, c]) => (c as PageConfig).linkedSourcePage === targetPage)
        .map(([name]) => name);

      for (const trackerName of linkedTrackers) {
        const trackerRows = state.pageRows[trackerName] || [];
        const newTrackerRows = trackerRows.filter(r => String(r.id) !== safeRowId);
        if (newTrackerRows.length < trackerRows.length) {
          await fetch(`/api/pageRows/${encodeURIComponent(trackerName)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: newTrackerRows })
          });
          setState(prev => ({
            ...prev,
            pageRows: { ...prev.pageRows, [trackerName]: newTrackerRows }
          }));
        }
      }
      
      setSelectedRowIds(prev => {
        const next = new Set(prev);
        next.delete(safeRowId);
        next.delete(rowId); // Clean both potential type keys safely
        return next;
      });
      
      if (String(previewContext?.rowId) === safeRowId) {
        setPreviewContext(null);
      }
      if (String(editingRowId) === safeRowId) {
        setEditingRowId(null);
      }
      setHoveredImage(null);
      toast('Row deleted');
    } catch (err) {
      console.error(err);
      toast('Failed to delete row from database');
    }
  };

  const handleReplaceImage = async (newImage: any, pageName?: string) => {
    if (!previewContext) return;
    const targetPage = pageName || previewContext.sourcePage;
    const currentRows = [...(state.pageRows[targetPage] || [])];
    const idx = currentRows.findIndex(r => r.id === previewContext.rowId);
    if (idx >= 0) {
      currentRows[idx] = { ...currentRows[idx], [previewContext.imageKey]: newImage.data || newImage };
    }

    try {
      await fetch(`/api/pageRows/${encodeURIComponent(targetPage)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: currentRows })
      });

      setState(prev => ({
        ...prev,
        pageRows: {
          ...prev.pageRows,
          [targetPage]: currentRows
        }
      }));
      toast('Image replaced successfully');
    } catch (err) {
      console.error(err);
      toast('Failed to replace image in database');
    }
  };

  const handleDeleteImage = async (rowId: string, imageKey: string, pageName?: string) => {
    const targetPage = pageName || previewContext?.sourcePage || state.activePage;
    const currentRows = [...(state.pageRows[targetPage] || [])];
    const idx = currentRows.findIndex(r => r.id === rowId);
    if (idx >= 0) {
      currentRows[idx] = { ...currentRows[idx], [imageKey]: '' };
    }

    try {
      await fetch(`/api/pageRows/${encodeURIComponent(targetPage)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: currentRows })
      });

      setState(prev => ({
        ...prev,
        pageRows: {
          ...prev.pageRows,
          [targetPage]: currentRows
        }
      }));
      setPreviewContext(null);
      setHoveredImage(null);
      toast('Image deleted');
    } catch (err) {
      console.error(err);
      toast('Failed to delete image from database');
    }
  };

  const sortRows = (rows: RowData[], columns: Column[]) => {
    const sortableColumns = columns
      .filter(c => c.sortEnabled && c.key !== 'sr')
      .sort((a, b) => (a.sortPriority || 0) - (b.sortPriority || 0));

    if (sortableColumns.length === 0) return rows;

    return [...rows].sort((a, b) => {
      for (const col of sortableColumns) {
        const key = col.key;
        let valA = a[key];
        let valB = b[key];

        if (valA === null || valA === undefined) valA = '';
        if (valB === null || valB === undefined) valB = '';

        let comparison = 0;
        if (col.type === 'number') {
          const numA = parseFloat(valA);
          const numB = parseFloat(valB);
          if (!isNaN(numA) && !isNaN(numB)) comparison = numA - numB;
          else if (isNaN(numA) && !isNaN(numB)) comparison = 1;
          else if (!isNaN(numA) && isNaN(numB)) comparison = -1;
          else comparison = 0;
        } else if (col.type === 'date') {
          const dateA = new Date(valA).getTime();
          const dateB = new Date(valB).getTime();
          if (!isNaN(dateA) && !isNaN(dateB)) comparison = dateA - dateB;
          else if (isNaN(dateA) && !isNaN(dateB)) comparison = 1;
          else if (!isNaN(dateA) && isNaN(dateB)) comparison = -1;
          else comparison = 0;
        } else {
          // Added .trim() to fix hidden spacing issues in sorting
          comparison = String(valA).trim().toLowerCase().localeCompare(String(valB).trim().toLowerCase());
        }

        if (comparison !== 0) {
          return col.sortDirection === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  };

  const filteredRows = useMemo(() => {
    let rows = activeRows;
    const activeQueries = [...primarySearchTags, currentSearch.trim()].filter(Boolean);
    if (activeQueries.length > 0) {
      rows = rows.filter(row => {
        const colData = activeConfig.columns.map(col => {
          if (col.key === 'sr' || col.type === 'image' || col.type === 'file') return null;
          const val = row[col.key];
          const strVal = Array.isArray(val) ? val.join(' ') : (val !== null && val !== undefined ? String(val) : '');
          const cleanVal = decodeHtmlEntities(strVal).replace(/<!--[\s\S]*?-->/g, '').replace(/<br\s*\/?>/gi, ' ').replace(/&nbsp;/gi, ' ').toLowerCase();
          return { name: col.name.toLowerCase(), val: cleanVal };
        }).filter(Boolean) as {name: string, val: string}[];

        const globalBlob = colData.map(c => c.val).join(' ');
        
        return activeQueries.some(query => {
          let targetBlob = globalBlob;
          let searchString = query.toLowerCase();
          const colonIndex = searchString.indexOf(':');

          if (colonIndex > 0) {
            const prefix = searchString.substring(0, colonIndex).trim();
            const suffix = searchString.substring(colonIndex + 1).trim();
            const matchedCol = colData.find(c => c.name.includes(prefix) || prefix.includes(c.name));
            if (matchedCol) {
               targetBlob = matchedCol.val;
               searchString = suffix;
            }
          }

          const tokens = searchString.split(/\s+/).filter(Boolean);
          if (tokens.length === 0) return true;

          return tokens.every(t => {
            const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let bStart = '';
            let bEnd = '';
            if (/^[0-9]/.test(t)) {
              bStart = ''; // Removed strict numeric boundary for SKU compatibility
              bEnd = ''; 
            } else if (/^[a-zA-Z]/.test(t)) {
              if (t.length <= 2) {
                bStart = '(?<![a-zA-Z])';
                bEnd = '(?![a-zA-Z]{2,})';
              } else {
                bStart = ''; 
                bEnd = '';
              }
            }
            return new RegExp(bStart + escaped + bEnd, 'i').test(targetBlob);
          });
        });
      });
    }
    if (activeConfig.isTrackerPage && trackerFilter !== 'all') {
      const saleCols = activeConfig.columns.filter(c => c.type === 'sale_tracker');
      const latestSaleCol = saleCols.length > 0 ? saleCols[0].key : null;
      rows = rows.filter(row => {
        const total = parseFloat(String(row.total_qty || 0));
        const totalSales = saleCols.reduce((sum, c) => sum + parseFloat(String(row[c.key] || 0)), 0);
        const remaining = total - totalSales;
        const minStock = activeConfig.minStockAlert || 5;
        const latestSaleVal = latestSaleCol ? parseFloat(String(row[latestSaleCol] || 0)) : 0;

        if (trackerFilter === 'low') {
          return remaining <= minStock;
        } else if (trackerFilter === 'zero') {
          return latestSaleVal === 0 || !row[latestSaleCol!];
        } else if (trackerFilter === 'high') {
          return latestSaleVal > 0;
        }
        return true;
      });
      if (trackerFilter === 'high' && latestSaleCol) {
         rows = rows.sort((a, b) => parseFloat(String(b[latestSaleCol]||0)) - parseFloat(String(a[latestSaleCol]||0)));
      }
    }

    return sortRows(rows, activeConfig.columns);
  }, [activeRows, currentSearch, primarySearchTags, activeConfig.columns, activeConfig.isTrackerPage, activeConfig.minStockAlert, trackerFilter]);

  const secondaryFilteredRows = useMemo(() => {
    if (!activeConfig.secondarySearchPage) return [];
    const secRows = state.pageRows[activeConfig.secondarySearchPage] || [];
    const secConfig = state.pageConfigs[activeConfig.secondarySearchPage];
    if (!secConfig) return [];
    
    let rows = secRows;
    const activeQueries = [...secondarySearchTags, secondarySearchQuery.trim()].filter(Boolean);
    if (activeQueries.length > 0) {
      rows = rows.filter(row => {
        const colData = secConfig.columns.map(col => {
          if (col.key === 'sr' || col.type === 'image' || col.type === 'file') return null;
          const val = row[col.key];
          const strVal = Array.isArray(val) ? val.join(' ') : (val !== null && val !== undefined ? String(val) : '');
          const cleanVal = decodeHtmlEntities(strVal).replace(/<!--[\s\S]*?-->/g, '').replace(/<br\s*\/?>/gi, ' ').replace(/&nbsp;/gi, ' ').toLowerCase();
          return { name: col.name.toLowerCase(), val: cleanVal };
        }).filter(Boolean) as {name: string, val: string}[];

        const globalBlob = colData.map(c => c.val).join(' ');
        
        return activeQueries.some(query => {
          let targetBlob = globalBlob;
          let searchString = query.toLowerCase();
          const colonIndex = searchString.indexOf(':');

          if (colonIndex > 0) {
            const prefix = searchString.substring(0, colonIndex).trim();
            const suffix = searchString.substring(colonIndex + 1).trim();
            const matchedCol = colData.find(c => c.name.includes(prefix) || prefix.includes(c.name));
            if (matchedCol) {
               targetBlob = matchedCol.val;
               searchString = suffix;
            }
          }

          const tokens = searchString.split(/\s+/).filter(Boolean);
          if (tokens.length === 0) return true;

          return tokens.every(t => {
            const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let bStart = '';
            let bEnd = '';
            if (/^[0-9]/.test(t)) {
              bStart = ''; // Removed strict numeric boundary for SKU compatibility
              bEnd = ''; 
            } else if (/^[a-zA-Z]/.test(t)) {
              if (t.length <= 2) {
                bStart = '(?<![a-zA-Z])';
                bEnd = '(?![a-zA-Z]{2,})';
              } else {
                bStart = ''; 
                bEnd = '';
              }
            }
            return new RegExp(bStart + escaped + bEnd, 'i').test(targetBlob);
          });
        });
      });
    }
    if (secConfig.isTrackerPage && trackerFilter !== 'all') {
      const saleCols = secConfig.columns.filter(c => c.type === 'sale_tracker');
      const latestSaleCol = saleCols.length > 0 ? saleCols[0].key : null;
      rows = rows.filter(row => {
        const total = parseFloat(String(row.total_qty || 0));
        const totalSales = saleCols.reduce((sum, c) => sum + parseFloat(String(row[c.key] || 0)), 0);
        const remaining = total - totalSales;
        const minStock = secConfig.minStockAlert || 5;
        const latestSaleVal = latestSaleCol ? parseFloat(String(row[latestSaleCol] || 0)) : 0;

        if (trackerFilter === 'low') {
          return remaining <= minStock;
        } else if (trackerFilter === 'zero') {
          return latestSaleVal === 0 || !row[latestSaleCol!];
        } else if (trackerFilter === 'high') {
          return latestSaleVal > 0;
        }
        return true;
      });
      if (trackerFilter === 'high' && latestSaleCol) {
         rows = rows.sort((a, b) => parseFloat(String(b[latestSaleCol]||0)) - parseFloat(String(a[latestSaleCol]||0)));
      }
    }

    return sortRows(rows, secConfig.columns);
  }, [state.pageRows, state.pageConfigs, activeConfig.secondarySearchPage, secondarySearchQuery, secondarySearchTags, trackerFilter]);

    const highlightText = (text: any, tokens: string[], isGhost: boolean = false) => {
      const strText = decodeHtmlEntities(String(text || ''));
      const cleanText = strText ? strText.replace(/<!--[\s\S]*?-->/g, '').replace(/<br\s*\/?>/gi, ' ').replace(/&nbsp;/gi, ' ') : '';
      if (!tokens || tokens.length === 0 || !cleanText) return cleanText;
      
      const escapedStrings = tokens.map(t => {
        const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let bStart = '';
        let bEnd = '';
        if (/^[0-9]/.test(t)) {
          bStart = ''; // Removed strict numeric boundary for SKU compatibility
          bEnd = '';
        } else if (/^[a-zA-Z]/.test(t)) {
          if (t.length <= 2) {
            bStart = '(?<![a-zA-Z])';
            bEnd = '(?![a-zA-Z]{2,})'; // Restored strict end boundary
          } else {
            bStart = '';
          }
        }
        return bStart + escaped + bEnd;
      });
      const regex = new RegExp('(' + escapedStrings.join('|') + ')', 'gi');
      const parts = cleanText.split(regex);
      const highlightClass = isGhost 
        ? "bg-green-100 text-green-900 border border-green-500 font-bold rounded-sm px-[1px]" 
        : "bg-yellow-300 text-black font-bold rounded-sm px-[1px]";
      return parts.map((part, i) => 
        regex.test(part) ? <span key={i} className={highlightClass}>{part}</span> : part
      );
    };

    const highlightHtmlText = (htmlString: string, tokens: string[], isGhost: boolean = false) => {
      const decodedHtml = decodeHtmlEntities(htmlString);
      const cleanHtml = decodedHtml ? decodedHtml.replace(/<!--[\s\S]*?-->/g, '').replace(/&nbsp;/gi, ' ') : '';
      if (!tokens || tokens.length === 0 || !cleanHtml) return cleanHtml;
      const escapedStrings = tokens.map(t => {
        const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let bStart = '';
        let bEnd = '';
        if (/^[0-9]/.test(t)) {
          bStart = ''; // Removed strict numeric boundary for SKU compatibility
          bEnd = '';
        } else if (/^[a-zA-Z]/.test(t)) {
          if (t.length <= 2) {
            bStart = '(?<![a-zA-Z])';
            bEnd = '(?![a-zA-Z]{2,})'; // Restored strict end boundary
          } else {
            bStart = '';
          }
        }
        return bStart + escaped + bEnd;
      });
      const regex = new RegExp('(' + escapedStrings.join('|') + ')(?![^<]*>)', 'gi');
      const highlightClass = isGhost 
        ? "bg-green-100 text-green-900 border border-green-500 font-bold rounded-sm px-[1px]" 
        : "bg-yellow-300 text-black font-bold rounded-sm px-[1px]";
      return cleanHtml.replace(regex, match => `<span class="${highlightClass}">${match}</span>`);
    };

  const primaryQueries = [...primarySearchTags, currentSearch.trim()].filter(Boolean);
  const secondaryQueries = [...secondarySearchTags, secondarySearchQuery.trim()].filter(Boolean);

  const isSecondaryActive = activeSearchView === 'secondary' && !!(activeConfig.secondarySearchPage && state.pageConfigs[activeConfig.secondarySearchPage]);
  const displayConfig = isSecondaryActive ? state.pageConfigs[activeConfig.secondarySearchPage!] : activeConfig;
  const displayRows = isSecondaryActive ? secondaryFilteredRows : filteredRows;
  const displayQueries = isSecondaryActive ? secondaryQueries : primaryQueries;

  const parentRef = useRef<HTMLDivElement>(null);
  const savedPrimScroll = useRef(0);
  const savedSecScroll = useRef(0);
  const wasPrimSearchActive = useRef(false);
  const wasSecSearchActive = useRef(false);

  const prevPrimQueries = useRef<string[]>([]);
  const prevSecQueries = useRef<string[]>([]);
  const [ghostPrimQueries, setGhostPrimQueries] = useState<string[]>([]);
  const [ghostSecQueries, setGhostSecQueries] = useState<string[]>([]);
  const latestPrimFilteredIds = useRef<Set<string>>(new Set());
  const latestSecFilteredIds = useRef<Set<string>>(new Set());
  const [ghostPrimIds, setGhostPrimIds] = useState<Set<string>>(new Set());
  const [ghostSecIds, setGhostSecIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Primary
    if (primaryQueries.length > 0 && !wasPrimSearchActive.current) {
      prevPrimQueries.current = primaryQueries;
      setGhostPrimQueries([]);
      setGhostPrimIds(new Set());
      wasPrimSearchActive.current = true;
    } else if (primaryQueries.length === 0 && wasPrimSearchActive.current) {
      wasPrimSearchActive.current = false;
      if (localSettings.ghostHighlight) {
        setGhostPrimQueries(prevPrimQueries.current);
        setGhostPrimIds(latestPrimFilteredIds.current);
        setTimeout(() => {
          if (parentRef.current) parentRef.current.scrollTop = savedPrimScroll.current;
        }, 100);
      }
    }

    // Secondary
    if (secondaryQueries.length > 0 && !wasSecSearchActive.current) {
      prevSecQueries.current = secondaryQueries;
      setGhostSecQueries([]);
      setGhostSecIds(new Set());
      wasSecSearchActive.current = true;
    } else if (secondaryQueries.length === 0 && wasSecSearchActive.current) {
      wasSecSearchActive.current = false;
      if (localSettings.ghostHighlight) {
        setGhostSecQueries(prevSecQueries.current);
        setGhostSecIds(latestSecFilteredIds.current);
        setTimeout(() => {
          if (parentRef.current) parentRef.current.scrollTop = savedSecScroll.current;
        }, 100);
      }
    }
  }, [primaryQueries.length, secondaryQueries.length]);

  useEffect(() => {
    if (primaryQueries.length > 0) latestPrimFilteredIds.current = new Set(filteredRows.map(r => String(r.id)));
  }, [filteredRows, primaryQueries.length]);

  useEffect(() => {
    if (secondaryQueries.length > 0) latestSecFilteredIds.current = new Set(secondaryFilteredRows.map(r => String(r.id)));
  }, [secondaryFilteredRows, secondaryQueries.length]);

  const virtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => displayConfig?.rowHeight || 100,
    overscan: 5,
  });

  const renderTable = (config: PageConfig, rows: RowData[], queries: string[], isSecondary: boolean, originalRows: RowData[], isGhost: boolean, ghostIds: Set<string>) => {
    const activePage = isSecondary ? activeConfig.secondarySearchPage : state.activePage;
    const isTableSorted = config.columns.some(col => col.sortEnabled && col.sortPriority && col.sortPriority > 0);
    const visibleColumns = config.columns.filter(col => showArchived || !col.archived);
    if (!config || !config.columns) {
      return (
        <div className="flex flex-col items-center justify-center p-20 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 m-4">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-bold text-gray-700">Page Configuration Missing</h3>
        </div>
      );
    }

    const virtualItems = virtualizer.getVirtualItems();
    const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
    const paddingBottom = virtualItems.length > 0 ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end : 0;
    const colSpan = visibleColumns.length + (!isSecondary && config.rowReorderEnabled ? 1 : 0);

    const colTokensMap: Record<string, string[]> = {};
    visibleColumns.forEach(col => {
        let tokens: string[] = [];
        queries.forEach(query => {
            const qLower = query.toLowerCase();
            const colonIndex = qLower.indexOf(':');
            if (colonIndex > 0) {
                const prefix = qLower.substring(0, colonIndex).trim();
                const suffix = qLower.substring(colonIndex + 1).trim();
                if (col.name.toLowerCase().includes(prefix) || prefix.includes(col.name.toLowerCase())) {
                    tokens.push(...suffix.split(/\s+/).filter(Boolean));
                }
            } else {
                tokens.push(...qLower.split(/\s+/).filter(Boolean));
            }
        });
        colTokensMap[col.key] = tokens;
    });

    return (
      <div 
        className="flex-1 min-h-0 overflow-auto border-none rounded-none m-0 p-0 relative outline-none" 
        ref={parentRef}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
          if (e.key === 'Home') { e.preventDefault(); virtualizer.scrollToIndex(0); }
          else if (e.key === 'End') { e.preventDefault(); virtualizer.scrollToIndex(rows.length - 1); }
          else if (e.key === 'PageUp') { e.preventDefault(); if (parentRef.current) parentRef.current.scrollTop -= parentRef.current.clientHeight; }
          else if (e.key === 'PageDown') { e.preventDefault(); if (parentRef.current) parentRef.current.scrollTop += parentRef.current.clientHeight; }
        }}
        onScroll={(e) => {
          const isActualSearchEmpty = queries.length === 0 || isGhost;
          if (isSecondary) {
            if (isActualSearchEmpty) savedSecScroll.current = e.currentTarget.scrollTop;
          } else {
            if (isActualSearchEmpty) savedPrimScroll.current = e.currentTarget.scrollTop;
          }
        }}
      >
        <DragDropContext onDragEnd={isSecondary ? () => {} : handleDragEnd}>
        <table 
          className="w-full border-collapse table-fixed text-[14px] font-normal"
          onMouseOver={handleTableMouseOver}
          onMouseOut={handleTableMouseOut}
        >
          <thead>
            <tr>
              {!isSecondary && config.rowReorderEnabled && (
                <th className={`sticky top-0 z-20 text-center p-1.5 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] w-[60px] bg-[#f3f3f3] data-[hovered-col=true]:bg-[#fce7f3]`}>
                  <input 
                    type="checkbox" 
                    className="cursor-pointer"
                    checked={rows.length > 0 && selectedRowIds.size === rows.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRowIds(new Set(rows.map(r => r.id)));
                      } else {
                        setSelectedRowIds(new Set());
                      }
                    }}
                  />
                </th>
              )}
              {visibleColumns.map((col, i) => {
                const widthStyle = col.width ? { width: `${col.width}px`, minWidth: `${col.width}px` } : {};
                const srWidthStyle = col.key === 'sr' ? { width: `${state.globalRowNoWidth || 100}px`, minWidth: `${state.globalRowNoWidth || 100}px` } : {};
                const finalWidthStyle = { ...widthStyle, ...srWidthStyle };
                const defaultWidthClass = col.key === 'sr' ? 'text-center' : col.type === 'image' ? 'w-[137px] text-center' : 'min-w-[130px] text-left';
                
                return (
                  <th 
                    key={col.key} 
                    className={`sticky top-0 z-20 text-[14px] font-bold text-[#2f3d49] p-1.5 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] ${!col.width && col.key !== 'sr' ? defaultWidthClass : (col.key === 'sr' || col.type === 'image' ? 'text-center' : 'text-left')} bg-[#f3f3f3] data-[hovered-col=true]:bg-[#fce7f3]`}
                    style={finalWidthStyle}
                  >
                    <div className="flex items-center gap-1">
                      {i + 1}. {col.name} {col.sortPriority ? <span className="text-[10px] font-bold text-gray-500">(P{col.sortPriority})</span> : ''} {col.locked && '🔒'}
                      {col.sortEnabled && col.key !== 'sr' && (
                        <div className="flex items-center gap-0.5">
                          {col.sortDirection === 'desc' ? <ArrowDown size={12} className={col.sortLocked ? 'text-gray-400' : ''} /> : <ArrowUp size={12} className={col.sortLocked ? 'text-gray-400' : ''} />}
                          {col.sortLocked && <Lock size={12} className="text-gray-500" />}
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <Droppable droppableId={`droppable-tbody-${isSecondary ? 'secondary' : 'primary'}`}>
            {(provided) => (
              <tbody ref={provided.innerRef} {...provided.droppableProps}>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="text-center text-[#90a4ae] font-normal p-1.5 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0]">
                      {queries.length > 0 ? 'No rows match your search.' : 'No row data yet.'}
                    </td>
                  </tr>
                ) : (
                  <>
                    {paddingTop > 0 && (
                      <tr>
                        <td colSpan={colSpan} style={{ height: `${paddingTop}px` }} />
                      </tr>
                    )}
                    {virtualItems.map((virtualItem) => {
                      const rowIndex = virtualItem.index;
                      const row = rows[rowIndex];
                      const isActiveRow = !(isGhost && !ghostIds.has(String(row.id)));
                      return (
                        // @ts-ignore
                        <Draggable key={row.id} draggableId={`${isSecondary ? 'sec-' : ''}${row.id}`} index={rowIndex} isDragDisabled={isSecondary || !config.rowReorderEnabled || queries.length > 0}>
                          {(provided, snapshot) => (
                        <tr 
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`${!isSecondary && selectedRowIds.has(row.id) ? 'bg-[#e8f0fe]' : ''} ${snapshot.isDragging ? 'bg-[#e8f0fe] shadow-xl table' : ''}`}
                          style={{
                            ...provided.draggableProps.style,
                            ...(snapshot.isDragging && { display: 'table', tableLayout: 'fixed' }),
                            height: `${config.rowHeight || 100}px`
                          }}
                        >
                          {!isSecondary && config.rowReorderEnabled && (
                            <td 
                              className={`text-center p-1.5 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] data-[hovered-col=true]:bg-[#f0f7ff] data-[hovered-row=true]:bg-[#e8f0fe] data-[hovered-exact=true]:!bg-[#d2e3fc] data-[hovered-exact=true]:outline data-[hovered-exact=true]:outline-[3px] data-[hovered-exact=true]:outline-[#2b579a] data-[hovered-exact=true]:relative data-[hovered-exact=true]:z-10 data-[hovered-exact=true]:shadow-inner`}
                            >
                              <div className="flex items-center justify-center gap-2">
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-700">
                                  <GripVertical size={16} />
                                </div>
                                <input 
                                  type="checkbox" 
                                  className="cursor-pointer"
                                  checked={selectedRowIds.has(row.id)}
                                  onChange={(e) => {
                                    const newSet = new Set(selectedRowIds);
                                    if (e.target.checked) newSet.add(row.id);
                                    else newSet.delete(row.id);
                                    setSelectedRowIds(newSet);
                                  }}
                                />
                              </div>
                            </td>
                          )}
                          {visibleColumns.map((col, colIndex) => {
                            const widthStyle = col.width ? { width: `${col.width}px`, minWidth: `${col.width}px` } : {};
                            const hoverClass = 'data-[hovered-col=true]:bg-[#f0f7ff] data-[hovered-row=true]:bg-[#e8f0fe] data-[hovered-exact=true]:!bg-[#d2e3fc] data-[hovered-exact=true]:outline data-[hovered-exact=true]:outline-[3px] data-[hovered-exact=true]:outline-[#2b579a] data-[hovered-exact=true]:relative data-[hovered-exact=true]:z-10 data-[hovered-exact=true]:shadow-inner';
                            const colTokens = isActiveRow ? (colTokensMap[col.key] || []) : [];
                            
                            const commonProps = {
                              style: widthStyle
                            };

                            if (col.key === 'sr') {
                              const srWidthStyle = { width: `${state.globalRowNoWidth || 100}px`, minWidth: `${state.globalRowNoWidth || 100}px` };
                              const finalSrStyle = col.width ? { width: `${col.width}px`, minWidth: `${col.width}px` } : srWidthStyle;
                              return (
                                <td key={col.key} {...commonProps} style={{...commonProps.style, ...finalSrStyle}} className={`font-normal p-1 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] bg-[#f3f3f3] data-[hovered-row=true]:bg-[#fce7f3] overflow-hidden`}>
                                  <div className="flex items-center justify-center gap-0 px-0.5 whitespace-nowrap">
                                    <span className="text-[14px]">{isTableSorted ? rowIndex + 1 : originalRows.findIndex(r => r.id === row.id) + 1}.</span>
                                    <div className="flex items-center shrink-0">
                                      <button 
                                        className="border-0 bg-transparent cursor-pointer text-[14px] hover:scale-110 transition-transform p-0" 
                                        title="Edit Row"
                                        onClick={() => { 
                                          setEditingRowId(row.id); 
                                          setEditingPageName(isSecondary ? activeConfig.secondarySearchPage! : state.activePage);
                                          toggleModal('addRow', true); 
                                        }}
                                      >
                                        ✏️
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              );
                            }
                            
                            const rawVal = row[col.key];
                            
                            if (col.type === 'image') {
                              const imgData = typeof rawVal === 'object' && rawVal !== null ? rawVal.data : rawVal;
                              const isImg = typeof imgData === 'string' && (imgData.startsWith('data:image') || /^https?:\/\//i.test(imgData) || imgData.includes('.'));
                              return (
                                <td 
                                  key={col.key} 
                                  {...commonProps} 
                                  className={`text-center p-0 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] ${hoverClass} bg-white overflow-hidden`}
                                  style={{...commonProps.style, height: `${config.rowHeight || 100}px`}}
                                  onMouseMove={(e) => {
                                    if (isImg && config.hoverPreviewEnabled) {
                                      setHoveredImage({ url: getImageUrl(imgData), x: e.clientX, y: e.clientY });
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    setHoveredImage(null);
                                  }}
                                >
                                  {isImg ? (
                                    <img 
                                      src={getImageUrl(imgData)} 
                                      alt="img" 
                                      loading="lazy"
                                      className="w-full h-full object-contain cursor-pointer block"
                                      onClick={() => {
                                        setPreviewContext({ 
                                          rowId: row.id, 
                                          imageKey: col.key, 
                                          pageName: isSecondary ? activeConfig.secondarySearchPage! : state.activePage 
                                        });
                                        toggleModal('imagePreview', true);
                                      }}
                                    />
                                  ) : (
                                    <span className="w-full h-full inline-flex items-center justify-center text-[#9e9e9e] text-2xl bg-[#fafafa]">📷</span>
                                  )}
                                </td>
                              );
                            }

                            if (col.type === 'text_with_copy_button') {
                              const items = Array.isArray(rawVal) ? rawVal.map(v => String(v || '').trim()).filter(Boolean) : (String(rawVal || '').trim() ? [String(rawVal).trim()] : []);
                              const isCellActive = activePopupId?.startsWith(`${row.id}-${col.key}`);
                              const cellClass = isCellActive 
                                ? 'bg-[#fff3cd] shadow-[inset_0_0_0_2px_#fac800] relative z-10 transition-all'
                                : hoverClass;
                              
                              return (
                                <td key={col.key} {...commonProps} className={`p-1.5 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] ${cellClass} overflow-hidden`}>
                                  {items.length > 0 && (
                                    <div className="flex flex-col gap-1">
                                      {items.map((item, i) => {
                                        const hideButton = item.startsWith('!');
                                        let displayText = hideButton ? item.slice(1) : item;
                                        displayText = decodeHtmlEntities(displayText).replace(/<!--[\s\S]*?-->/g, '').replace(/&nbsp;/gi, ' ');
                                        const itemId = `${row.id}-${col.key}-${i}`;
                                        const hasHtml = /<[a-z][\s\S]*>/i.test(displayText);
                                        return (
                                          <div key={i} className={`flex items-center justify-between gap-1.5 border border-[#d7e3f6] bg-[#f9fcff] rounded px-1.5 py-0.5 min-h-[25px] ${hideButton ? 'bg-gray-50 border-gray-100 opacity-80' : ''}`}>
                                            {hasHtml ? <span className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: highlightHtmlText(displayText, colTokens, isGhost) }} /> : <span className="whitespace-pre-wrap">{highlightText(displayText, colTokens, isGhost)}</span>}
                                            {!hideButton && (
                                              <>
                                                <button 
                                                  className="border-0 rounded bg-[#2b579a] text-white px-1.5 py-0.5 text-[11px] font-bold cursor-pointer shrink-0"
                                                  onClick={(e) => {
                                                    const target = e.currentTarget;
                                                    const plainText = hasHtml ? displayText.replace(/<[^>]*>?/gm, '') : displayText;
                                                    navigator.clipboard.writeText(plainText).then(() => {
                                                      setActivePopupId(itemId);
                                                      setActiveAnchor(target);
                                                      const activeCopyCfg = state.pageConfigs[state.activePage]?.copyBoxConfig;
                                                      if (activeCopyCfg) {
                                                        const currentPage = isSecondary ? activeConfig.secondarySearchPage! : state.activePage;
                                                        if (activeCopyCfg.box1.sourcePage === currentPage && activeCopyCfg.box1.sourceColumn === col.key) setBox1Value(plainText);
                                                        if (activeCopyCfg.box2.sourcePage === currentPage && activeCopyCfg.box2.sourceColumn === col.key) setBox2Value(plainText);
                                                      }
                                                    });
                                                  }}
                                                >
                                                  Copy
                                                </button>
                                                <CopyPopupNotification 
                                                  text={hasHtml ? displayText.replace(/<[^>]*>?/gm, '') : displayText} 
                                                  columnName={col.name} 
                                                  columnNumber={colIndex + 1} 
                                                  isActive={activePopupId === itemId}
                                                  anchorElement={activeAnchor}
                                                  onClose={handleClosePopup}
                                                />
                                              </>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>
                              );
                            }

                            if (config.isTrackerPage) {
                              if (col.key === 'remaining_qty') {
                                const total = parseFloat(String(row.total_qty || 0));
                                const totalSales = config.columns.filter(c => c.type === 'sale_tracker').reduce((sum, c) => sum + parseFloat(String(row[c.key] || 0)), 0);
                                const remaining = total - totalSales;
                                const minStock = config.minStockAlert || 5;
                                
                                let stateClass = hoverClass;
                                if (remaining < 0) stateClass = "bg-red-200 text-red-900 font-bold";
                                else if (remaining <= minStock) stateClass = "bg-red-50 text-red-900 font-bold";

                                return (
                                  <td key={col.key} {...commonProps} className={`p-1.5 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] overflow-hidden whitespace-pre-wrap ${stateClass}`}>
                                    {remaining}
                                  </td>
                                );
                              }

                              if (col.type === 'sale_tracker') {
                                const isEditing = inlineEdit?.id === `${row.id}-${col.key}`;
                                return (
                                  <td key={col.key} {...commonProps} className={`p-1.5 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] ${hoverClass} overflow-hidden align-top text-xs`}>
                                    {isEditing ? (
                                      <input 
                                        type="number" 
                                        autoFocus 
                                        value={inlineEdit.val} 
                                        onChange={(e) => setInlineEdit({...inlineEdit, val: e.target.value})}
                                        onBlur={() => handleSaveInlineEdit(activePage!, row.id, col.key, inlineEdit.val)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveInlineEdit(activePage!, row.id, col.key, inlineEdit.val); }}
                                        className="w-full p-1 border-2 border-blue-500 rounded text-xs" 
                                      />
                                    ) : (
                                      <div className="group flex items-center justify-between w-full h-full relative cursor-text min-h-[20px]" onClick={() => setInlineEdit({id: `${row.id}-${col.key}`, colKey: col.key, val: String(rawVal || 0)})}>
                                        <span>{rawVal || '0'}</span>
                                        <button className="hidden group-hover:block absolute right-0 text-gray-400 hover:text-blue-500 text-[10px]">✏️</button>
                                      </div>
                                    )}
                                  </td>
                                );
                              }
                            }

                            if (Array.isArray(rawVal)) {
                              return (
                                <td key={col.key} {...commonProps} className={`p-1.5 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] ${hoverClass} overflow-hidden`}>
                                  {rawVal.map((v, i) => {
                                    const strVal = String(v || '');
                                    const hasHtml = /<[a-z][\s\S]*>/i.test(strVal);
                                    return (
                                      <React.Fragment key={i}>
                                        {hasHtml ? <span className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: highlightHtmlText(strVal, colTokens, isGhost) }} /> : <span className="whitespace-pre-wrap">{highlightText(strVal, colTokens, isGhost)}</span>}
                                        <br/>
                                      </React.Fragment>
                                    );
                                  })}
                                </td>
                              );
                            }

                            const strRawVal = String(rawVal || '');
                            const hasHtmlRaw = /<[a-z][\s\S]*>/i.test(strRawVal);

                            return (
                              <td key={col.key} {...commonProps} className={`p-1.5 border-r-[length:medium] border-b-[length:medium] border-[#e0e0e0] ${hoverClass} overflow-hidden whitespace-pre-wrap`}>
                                {hasHtmlRaw ? <span dangerouslySetInnerHTML={{ __html: highlightHtmlText(strRawVal, colTokens, isGhost) }} /> : highlightText(rawVal, colTokens, isGhost)}
                              </td>
                            );
                          })}
                        </tr>
                      )}
                    </Draggable>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td colSpan={colSpan} style={{ height: `${paddingBottom}px` }} />
                  </tr>
                )}
              </>
            )}
            {provided.placeholder}
          </tbody>
        )}
      </Droppable>
        </table>
      </DragDropContext>
    </div>
    );
  };

  const tableContent = (
    <div className="w-full h-full flex flex-col text-[#333] text-left m-0 p-0">
      {isSecondaryActive && (
        <div className="bg-[#e8edf2] px-3 py-1.5 text-sm font-bold text-[#2b579a] border-y border-[#d8d8d8]">
          Viewing Secondary Data: {activeConfig.secondarySearchPage}
        </div>
      )}
      {displayConfig.isTrackerPage && (
        <div className="bg-[#e8edf2] px-3 py-2 flex flex-wrap gap-2 border-b border-[#d8d8d8] items-center">
          <button onClick={() => setIsSalePromptOpen(true)} className="bg-[#217346] text-white px-3 py-1.5 rounded text-xs font-bold shadow hover:bg-[#1e6b41]">➕ Add Sale Column</button>
          <button onClick={() => setIsArchiveModalOpen(true)} className="bg-amber-600 text-white px-3 py-1.5 rounded text-xs font-bold shadow hover:bg-amber-700 flex items-center gap-1">🗄️ Archive Column</button>
          <label className="flex items-center gap-1 text-xs font-bold text-gray-700 ml-2 cursor-pointer">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded" /> Show History
          </label>
          <div className="flex-1"></div>
          <div className="flex gap-1 bg-white rounded shadow-sm p-1">
            <button onClick={() => setTrackerFilter('high')} className={`px-2 py-1 rounded text-xs font-bold ${trackerFilter === 'high' ? 'bg-green-100 text-green-800' : 'text-gray-600 hover:bg-gray-100'}`}>⭐ High Sale</button>
            <button onClick={() => setTrackerFilter('zero')} className={`px-2 py-1 rounded text-xs font-bold ${trackerFilter === 'zero' ? 'bg-gray-200 text-gray-800' : 'text-gray-600 hover:bg-gray-100'}`}>0️⃣ Zero Sale</button>
            <button onClick={() => setTrackerFilter('low')} className={`px-2 py-1 rounded text-xs font-bold ${trackerFilter === 'low' ? 'bg-red-100 text-red-800' : 'text-gray-600 hover:bg-gray-100'}`}>🚨 Low Stock</button>
            <button onClick={() => setTrackerFilter('all')} className={`px-2 py-1 rounded text-xs font-bold ${trackerFilter === 'all' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-100'}`}>All</button>
          </div>
        </div>
      )}
      {(() => {
        const isGhostActive = displayQueries.length === 0 && (isSecondaryActive ? ghostSecQueries.length > 0 : ghostPrimQueries.length > 0);
        const finalQueries = displayQueries.length > 0 ? displayQueries : (isSecondaryActive ? ghostSecQueries : ghostPrimQueries);
        const originalRows = isSecondaryActive ? (state.pageRows[activeConfig.secondarySearchPage!] || []) : activeRows;
        const ghostIds = isSecondaryActive ? ghostSecIds : ghostPrimIds;
        return renderTable(displayConfig, displayRows, finalQueries, isSecondaryActive, originalRows, isGhostActive, ghostIds);
      })()}
    </div>
  );

  const isAnyModalOpen = Object.values(modals).some(v => v) || isDupModalOpen || showHistoryLimitModal || clearDBModal.isOpen || isImporting;

  return (
    <div className="flex flex-col h-screen max-w-full mx-auto gap-2 p-2 bg-[#f4f7f6] text-[#333] font-sans box-border">
      <div className="flex justify-between items-center bg-white border border-[#d8d8d8] rounded-md p-2 px-2.5">
        <div className="text-[19px] font-bold text-[#2c3e50]">
          📦 Dynamic Inventory Platform <span className="text-[#217346] text-sm">(Pro Classic Visual)</span>
        </div>
        <div className="flex gap-1.5 flex-wrap items-center relative">
          <Button variant="dark" onClick={() => toggleModal('createPage', true)}><Plus size={14} /> Add Page</Button>
          <div className="relative inline-block" ref={settingsRef}>
            <Button variant="dark" onClick={() => setShowTopSettings(!showTopSettings)}><Settings size={14} /> Settings</Button>
            {showTopSettings && (
              <div className="absolute right-0 top-[calc(100%+6px)] w-[260px] bg-white border border-[#d7dde1] rounded-md shadow-xl p-2 z-50">
                <div className="text-[11px] font-bold text-[#607d8b] border-b border-[#eceff1] mb-2 pb-1.5 uppercase tracking-wide">Settings</div>
                <div className="text-xs text-[#607d8b] px-1 pb-2 font-bold">
                  Active Page: <span className="text-gray-800">{state.activePage || 'No page selected'}</span>
                </div>
                <button 
                  className="w-full text-left border-0 rounded bg-[#f4f6f8] text-[#263238] text-xs font-bold p-2 cursor-pointer hover:bg-[#e8edf2] disabled:opacity-55 disabled:cursor-not-allowed"
                  disabled={!state.activePage}
                  onClick={() => {
                    setShowTopSettings(false);
                    toggleModal('activePageSettings', true);
                  }}
                >
                  ⚙️ Active Page Settings {state.activePage ? `(${state.activePage})` : ''}
                </button>
                
                <div className="text-[11px] font-bold text-[#607d8b] border-b border-[#eceff1] mb-2 mt-3 pb-1.5 uppercase tracking-wide">Global Settings</div>
                <button 
                  className="w-full text-left border-0 rounded bg-[#f4f6f8] text-[#263238] text-xs font-bold p-2 cursor-pointer hover:bg-[#e8edf2] mb-1"
                  onClick={() => {
                    setShowTopSettings(false);
                    toggleModal('rowNoResize', true);
                  }}
                >
                  📏 Row No. 🔒 Resize Setting
                </button>
                <button 
                  className="w-full text-left border-0 rounded bg-[#f4f6f8] text-[#263238] text-xs font-bold p-2 cursor-pointer hover:bg-[#e8edf2] mb-1"
                  onClick={() => { setShowTopSettings(false); setTempHistoryLimit(maxSearchHistory); setShowHistoryLimitModal(true); }}
                >
                  🕒 Search History Limit
                </button>

                <div className="text-[11px] font-bold text-[#607d8b] border-b border-[#eceff1] mb-2 mt-3 pb-1.5 uppercase tracking-wide">Pages Reorder</div>
                <button 
                  className="w-full text-left border-0 rounded bg-[#f4f6f8] text-[#263238] text-xs font-bold p-2 cursor-pointer hover:bg-[#e8edf2] mb-1"
                  onClick={() => {
                    setShowTopSettings(false);
                    toggleModal('reorderPages', true);
                  }}
                >
                  🔄 Pages Reorder
                </button>

                <div className="text-[11px] font-bold text-[#607d8b] border-b border-[#eceff1] mb-2 mt-3 pb-1.5 uppercase tracking-wide">DATA BACKUP:</div>
                <button 
                  className="w-full text-left border-0 rounded bg-[#f4f6f8] text-[#263238] text-xs font-bold p-2 cursor-pointer hover:bg-[#e8edf2] mb-1"
                  onClick={() => {
                    setShowTopSettings(false);
                    handleExportData();
                  }}
                >
                  💾 Export Backup (JSON)
                </button>
                <button 
                  className="w-full text-left border-0 rounded bg-[#f4f6f8] text-[#263238] text-xs font-bold p-2 cursor-pointer hover:bg-[#e8edf2]"
                  onClick={() => {
                    setShowTopSettings(false);
                    setTimeout(() => {
                      fileInputRef.current?.click();
                    }, 50);
                  }}
                >
                  📂 Import Backup (JSON)
                </button>

                <div className="text-[11px] font-bold text-blue-600 border-b border-blue-100 mb-2 mt-3 pb-1.5 uppercase tracking-wide">Device Specific (This PC Only)</div>
                <div className="flex items-center justify-between p-2 bg-[#f4f6f8] rounded mb-1">
                  <span className="text-xs font-bold text-[#263238]">Highlight Scroll Position</span>
                  <button 
                    className={`px-3 py-1 rounded text-[10px] font-bold border-0 cursor-pointer ${localSettings.ghostHighlight ? 'bg-green-600 text-white' : 'bg-gray-400 text-white'}`}
                    onClick={() => handleUpdateLocalSetting('ghostHighlight', !localSettings.ghostHighlight)}
                  >
                    {localSettings.ghostHighlight ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="text-[11px] font-bold text-red-600 border-b border-red-100 mb-2 mt-3 pb-1.5 uppercase tracking-wide">DANGER ZONE</div>
                <button 
                  className="w-full text-left border-0 rounded bg-blue-50 text-blue-700 text-xs font-bold p-2 cursor-pointer hover:bg-blue-100 mb-2"
                  onClick={async () => {
                    setShowTopSettings(false);
                    try {
                      toast('Migration started. Please wait...', { duration: 5000 });
                      const response = await fetch('/api/admin/migrate-images', { method: 'POST' });
                      const data = await response.json();
                      if (data.success) {
                        toast(`Migrated ${data.count} images successfully!`);
                        
                        if (data.brokenImages && data.brokenImages.length > 0) {
                          const message = `Found ${data.brokenImages.length} broken images. Please check these rows:\n\n` + 
                            data.brokenImages.map((b: any) => `[${b.page}] -> Row ID [${b.rowId}] -> Column [${b.column}]`).join('\n');
                          
                          setTimeout(() => {
                            setConfirmationModal({
                              isOpen: true,
                              title: "Missing Files Detected",
                              message: message,
                              confirmLabel: "Understood",
                              onConfirm: () => {
                                 if (data.count > 0) window.location.reload();
                              }
                            });
                          }, 500);
                        } else if (data.count > 0) {
                          setTimeout(() => window.location.reload(), 2000);
                        }
                      } else {
                        toast('Migration failed');
                      }
                    } catch (err) {
                      console.error(err);
                      toast('Migration failed');
                    }
                  }}
                >
                  🚀 Migrate All Images
                </button>
                <button 
                  className="w-full text-left border-0 rounded bg-red-50 text-red-700 text-xs font-bold p-2 cursor-pointer hover:bg-red-100 mb-1"
                  onClick={() => {
                    setShowTopSettings(false);
                    setClearDBModal({ isOpen: true, step: 1, yesLeft: Math.random() > 0.5 });
                  }}
                >
                  🗑️ Clear DB (Zero State)
                </button>
              </div>
            )}
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleImportData} 
            />
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap items-center bg-white border border-[#d8d8d8] rounded-md p-2 min-h-[44px]">
        {state.pages.length === 0 ? (
          <span className="text-xs text-[#90a4ae] font-bold">No pages yet. Click Add Page to create one.</span>
        ) : (
          state.pages.map(page => (
            <button
              key={page}
              className={`border border-[#cfd8dc] rounded-full px-2.5 py-1 text-xs font-bold cursor-pointer transition-colors ${page === state.activePage ? 'bg-[#2b579a] text-white border-[#2b579a]' : 'bg-[#eceff1] text-[#37474f] hover:bg-gray-200'}`}
              onClick={() => {
                setState(prev => ({ ...prev, activePage: page }));
                toast(`Active page: ${page}`);
              }}
            >
              {page}
            </button>
          ))
        )}
      </div>

      {activeConfig.copyBoxConfig && activeConfig.showCopyBoxes !== false && (
        <GlobalCombinationCopyBoxes 
          settings={activeConfig.copyBoxConfig} 
          box1Value={box1Value} 
          box2Value={box2Value} 
        />
      )}

      <div className="bg-white border border-[#d8d8d8] rounded-md p-2 flex gap-2">
        {(activeConfig.searchBarOrder || ['primary', 'secondary']).map((type) => {
          if (type === 'primary') {
            return (
              <div key="primary" className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 flex items-center gap-1 border-2 border-[#217346] rounded px-1 min-w-0 bg-white">
                  <div className="flex flex-wrap gap-1 max-w-[60%] overflow-hidden">
                    {primarySearchTags.map((tag, idx) => (
                      <span key={idx} className="flex items-center gap-1 bg-green-100 text-[#217346] text-[11px] font-bold px-2 py-0.5 rounded-full border border-green-200 whitespace-nowrap">
                        {tag}
                        <button onClick={() => handleRemovePrimaryTag(idx)} className="hover:text-red-500 transition-colors border-0 bg-transparent p-0 cursor-pointer flex items-center">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="relative flex-1 min-w-[100px]">
                    <Input ref={primaryInputRef} key={`prim-${isAnyModalOpen}`} onBeforeInput={(e: any) => { if (e.nativeEvent && e.nativeEvent.inputType && e.nativeEvent.inputType.startsWith('history')) e.preventDefault(); }} className="border-0 focus:ring-0 text-sm w-full pr-8 h-8" value={primarySearchInput} readOnly={isAnyModalOpen} onChange={e => { setPrimarySearchInput(e.target.value); if (e.target.value && (activeConfig.independentSearchBars === false)) setSecondarySearchInput(''); }} onFocus={() => { setActiveSearchView('primary'); }} onKeyDown={handlePrimKeyDown} />
                    {!primarySearchInput && primarySearchTags.length === 0 && <div className="absolute inset-y-0 left-0 flex items-center pl-0 pointer-events-none text-gray-400 text-sm whitespace-nowrap">🔍 Search Data {state.activePage ? <>For "<strong>{state.activePage}</strong>"</> : ""}</div>}
                  </div>
                  <button onClick={handleAddPrimaryTag} className="p-1 text-[#217346] hover:bg-green-100 rounded transition-colors border-0 bg-transparent cursor-pointer">
                    <Plus size={18} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 relative" ref={primHistRef}>
                  <button title="Undo (Ctrl+Z)" onClick={handlePrimUndo} disabled={primHist.pointer === 0} className="p-1.5 text-[#217346] hover:bg-green-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-0 bg-transparent cursor-pointer"><Undo2 size={18} /></button>
                  <button title="Redo (Ctrl+Y)" onClick={handlePrimRedo} disabled={primHist.pointer === primHist.entries.length - 1} className="p-1.5 text-[#217346] hover:bg-green-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-0 bg-transparent cursor-pointer"><Redo2 size={18} /></button>
                  <div className="relative">
                     <button title="Search History" onClick={() => setShowPrimHist(!showPrimHist)} className="p-1.5 text-[#217346] hover:bg-green-100 rounded transition-colors border-0 bg-transparent cursor-pointer"><History size={18} /></button>
                     {showPrimHist && (
                        <div className="absolute top-full right-0 mt-2 w-[280px] bg-white border border-gray-200 shadow-2xl rounded-lg z-50 py-1.5 max-h-[300px] overflow-y-auto">
                            <div className="px-3 py-1.5 border-b border-gray-100 text-[13px] font-bold text-gray-400 uppercase tracking-wider">Search History (Max {maxSearchHistory})</div>
                            {primHist.entries.map((entry, idx) => (
                                <div key={idx} onClick={() => { setPrimHist(prev => { isPrimUndoRef.current = true; setPrimarySearchInput(entry.value); return { ...prev, pointer: idx }; }); setShowPrimHist(false); }} className={`px-3 py-2 text-[12px] cursor-pointer flex justify-between items-center transition-all ${idx === primHist.pointer ? 'bg-[#e8f0fe] font-bold text-[#217346] border-l-[3px] border-[#217346]' : 'text-gray-700 hover:bg-gray-50'}`}>
                                   <span className="truncate max-w-[140px]">{entry.value || <span className="italic text-gray-400">Empty State</span>}</span>
                                   <span className="text-[10px] opacity-70 shrink-0 font-medium ml-2">{formatHistDate(entry.timestamp)}</span>
                                </div>
                            )).reverse()}
                        </div>
                     )}
                  </div>
                </div>
              </div>
            );
          } else if (type === 'secondary' && activeConfig.secondarySearchPage) {
            return (
              <div key="secondary" className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 flex items-center gap-1 border-2 border-[#2b579a] rounded px-1 min-w-0 bg-white">
                  <div className="flex flex-wrap gap-1 max-w-[60%] overflow-hidden">
                    {secondarySearchTags.map((tag, idx) => (
                      <span key={idx} className="flex items-center gap-1 bg-blue-100 text-[#2b579a] text-[11px] font-bold px-2 py-0.5 rounded-full border border-blue-200 whitespace-nowrap">
                        {tag}
                        <button onClick={() => handleRemoveSecondaryTag(idx)} className="hover:text-red-500 transition-colors border-0 bg-transparent p-0 cursor-pointer flex items-center">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="relative flex-1 min-w-[100px]">
                    <Input ref={secondaryInputRef} key={`sec-${isAnyModalOpen}`} onBeforeInput={(e: any) => { if (e.nativeEvent && e.nativeEvent.inputType && e.nativeEvent.inputType.startsWith('history')) e.preventDefault(); }} className="border-0 focus:ring-0 text-sm w-full pr-8 h-8" value={secondarySearchInput} readOnly={isAnyModalOpen} onChange={e => { setSecondarySearchInput(e.target.value); if (e.target.value && (activeConfig.independentSearchBars === false)) setPrimarySearchInput(''); }} onFocus={() => { setActiveSearchView('secondary'); }} onKeyDown={handleSecKeyDown} />
                    {!secondarySearchInput && secondarySearchTags.length === 0 && <div className="absolute inset-y-0 left-0 flex items-center pl-0 pointer-events-none text-gray-400 text-sm whitespace-nowrap">🔍 Search Data For "<strong>{activeConfig.secondarySearchPage}</strong>" (Secondary Search)</div>}
                  </div>
                  <button onClick={handleAddSecondaryTag} className="p-1 text-[#2b579a] hover:bg-blue-100 rounded transition-colors border-0 bg-transparent cursor-pointer">
                    <Plus size={18} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 relative" ref={secHistRef}>
                  <button title="Undo (Ctrl+Z)" onClick={handleSecUndo} disabled={secHist.pointer === 0} className="p-1.5 text-[#2b579a] hover:bg-blue-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-0 bg-transparent cursor-pointer"><Undo2 size={18} /></button>
                  <button title="Redo (Ctrl+Y)" onClick={handleSecRedo} disabled={secHist.pointer === secHist.entries.length - 1} className="p-1.5 text-[#2b579a] hover:bg-blue-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-0 bg-transparent cursor-pointer"><Redo2 size={18} /></button>
                  <div className="relative">
                     <button title="Search History" onClick={() => setShowSecHist(!showSecHist)} className="p-1.5 text-[#2b579a] hover:bg-blue-100 rounded transition-colors border-0 bg-transparent cursor-pointer"><History size={18} /></button>
                     {showSecHist && (
                        <div className="absolute top-full right-0 mt-2 w-[280px] bg-white border border-gray-200 shadow-2xl rounded-lg z-50 py-1.5 max-h-[300px] overflow-y-auto">
                            <div className="px-3 py-1.5 border-b border-gray-100 text-[13px] font-bold text-gray-400 uppercase tracking-wider">Search History (Max {maxSearchHistory})</div>
                            {secHist.entries.map((entry, idx) => (
                                <div key={idx} onClick={() => { setSecHist(prev => { isSecUndoRef.current = true; setSecondarySearchInput(entry.value); return { ...prev, pointer: idx }; }); setShowSecHist(false); }} className={`px-3 py-2 text-[12px] cursor-pointer flex justify-between items-center transition-all ${idx === secHist.pointer ? 'bg-[#e8f0fe] font-bold text-[#2b579a] border-l-[3px] border-[#2b579a]' : 'text-gray-700 hover:bg-gray-50'}`}>
                                   <span className="truncate max-w-[140px]">{entry.value || <span className="italic text-gray-400">Empty State</span>}</span>
                                   <span className="text-[10px] opacity-70 shrink-0 font-medium ml-2">{formatHistDate(entry.timestamp)}</span>
                                </div>
                            )).reverse()}
                        </div>
                     )}
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>

      <div className="flex-1 min-h-[260px] overflow-auto border border-gray-400 rounded-md bg-white flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-[#2b579a] text-base font-bold text-center p-5 flex-col">
            <RefreshCw className="animate-spin mb-2" size={32} />
            Loading Page Data...
          </div>
        ) : !state.activePage ? (
          <div className="flex-1 flex items-center justify-center text-[#90a4ae] text-base font-bold text-center p-5 flex-col">
            Blank Workspace Area<br/>
            <span className="text-xs font-semibold text-[#b0bec5]">(search bar intentionally kept as requested)</span>
          </div>
        ) : tableContent}
      </div>

      <CreatePageModal 
        isOpen={modals.createPage} 
        onClose={closeAllModals} 
        onCreate={handleCreatePage} 
        existingPages={state.pages} 
      />
      
      <AddRowModal 
        isOpen={modals.addRow} 
        onClose={closeAllModals} 
        onBack={returnToImagePreview ? () => {
          closeAllModals();
          toggleModal('imagePreview', true);
        } : (returnToSettings ? () => {
          closeAllModals();
          toggleModal('activePageSettings', true);
        } : undefined)}
        backText={returnToImagePreview ? "Back to Image Preview" : "Back to Active Page Settings"}
        onSave={(rows) => handleSaveRows(rows, previewContext?.pageName || editingPageName || undefined)} 
        onDelete={(id) => {
          handleDeleteRow(id, previewContext?.pageName || editingPageName || undefined);
          closeAllModals();
        }}
        columns={previewContext ? state.pageConfigs[previewContext.pageName].columns : (editingPageName ? state.pageConfigs[editingPageName].columns : activeConfig.columns)} 
        editingRow={editingRowId ? (state.pageRows[previewContext?.pageName || editingPageName || state.activePage] || []).find(r => r.id === editingRowId) || null : null} 
        editingRowIndex={editingRowId ? (state.pageRows[previewContext?.pageName || editingPageName || state.activePage] || []).findIndex(r => r.id === editingRowId) : -1}
        activePage={previewContext?.pageName || editingPageName || state.activePage} 
        onToggleMagicPasteColumn={handleToggleMagicPasteColumn}
        setConfirmationModal={setConfirmationModal}
        getImageUrl={getImageUrl}
      />

      <ActivePageSettingsModal 
        isOpen={modals.activePageSettings} 
        onClose={closeAllModals} 
        activePage={state.activePage} 
        pageConfig={state.activePage ? activeConfig : null} 
        onSave={handleSaveActivePageSettings} 
        onRenamePage={() => { setReturnToSettings(true); toggleModal('activePageSettings', false); toggleModal('renamePage', true); }} 
        onCreateColumn={() => { setReturnToSettings(true); toggleModal('activePageSettings', false); toggleModal('createColumn', true); }} 
        onAddRow={() => { setReturnToSettings(true); toggleModal('activePageSettings', false); toggleModal('addRow', true); }} 
        onEditColumn={handleEditColumnClick}
        onDeletePage={handleDeletePage}
        onReorderSearchBars={() => {
          setReturnToSettings(true);
          toggleModal('activePageSettings', false);
          toggleModal('reorderSearchBars', true);
        }}
        onImportExcel={() => {
          setReturnToSettings(true);
          toggleModal('activePageSettings', false);
          toggleModal('excelImport', true);
        }}
        onExportExcel={() => {
          setReturnToSettings(true);
          toggleModal('activePageSettings', false);
          toggleModal('excelExport', true);
        }}
        onImportPageJson={(file) => {
          handleImportPageJson(file);
        }}
        onExportPageJson={() => {
          handleExportPageJson();
        }}
        onFindDuplicates={() => {
          setReturnToSettings(true);
          toggleModal('activePageSettings', false);
          setIsDupModalOpen(true);
        }}
        onClearPageData={() => handleClearPageData(state.activePage)}
        existingPages={state.pages}
        setConfirmationModal={setConfirmationModal}
        onCreateTracker={handleCreateTracker}
        onConfigureCopyBoxes={() => {
          setReturnToSettings(true);
          toggleModal('activePageSettings', false);
          toggleModal('globalCopyBoxesSettings', true);
        }}
      />

      <RenamePageModal 
        isOpen={modals.renamePage} 
        onClose={closeAllModals} 
        onBack={() => {
          closeAllModals();
          toggleModal('activePageSettings', true);
        }}
        activePage={state.activePage} 
        onRename={handleRenamePage} 
        existingPages={state.pages} 
      />

      <CreateColumnModal 
        isOpen={modals.createColumn} 
        onClose={closeAllModals} 
        onBack={() => {
          closeAllModals();
          toggleModal('activePageSettings', true);
        }}
        onSave={handleCreateColumns} 
        existingColumns={activeConfig.columns} 
      />

      <EditColumnModal 
        isOpen={modals.editColumn} 
        onClose={closeAllModals} 
        onBack={() => {
          closeAllModals();
          toggleModal('activePageSettings', true);
        }}
        onSave={handleSaveEditedColumn} 
        onUpdate={handleUpdateColumnPreview}
        column={editingColumn} 
        existingColumns={activeConfig.columns} 
        setConfirmationModal={setConfirmationModal}
      />

      {/* ConfirmationModal is now global */}

      <ConfirmationModal
        isOpen={!!confirmationModal?.isOpen}
        onClose={() => setConfirmationModal(null)}
        onConfirm={() => {
          if (confirmationModal?.onConfirm) {
            confirmationModal.onConfirm();
          }
          setConfirmationModal(null);
        }}
        title={confirmationModal?.title}
        message={confirmationModal?.message}
        confirmLabel={confirmationModal?.confirmLabel}
      />

      <ImagePreviewModal 
        isOpen={modals.imagePreview} 
        onClose={closeAllModals} 
        row={previewContext ? (state.pageRows[previewContext.pageName] || []).find(r => r.id === previewContext.rowId) || null : null} 
        imageColKey={previewContext?.imageKey || ''} 
        columns={previewContext ? state.pageConfigs[previewContext.pageName].columns : activeConfig.columns} 
        rowIndex={previewContext ? (state.pageRows[previewContext.pageName] || []).findIndex(r => r.id === previewContext.rowId) : -1} 
        onEditRow={() => { 
          setReturnToImagePreview(true);
          toggleModal('imagePreview', false); 
          setEditingRowId(previewContext?.rowId || null); 
          setEditingPageName(previewContext?.pageName || null);
          toggleModal('addRow', true); 
        }} 
        onReplaceImage={(newImage) => handleReplaceImage(newImage, previewContext?.pageName)}
        onDeleteImage={(rowId, imageKey) => handleDeleteImage(rowId, imageKey, previewContext?.pageName)}
        activePopupId={activePopupId}
        setActivePopupId={setActivePopupId}
        activeAnchor={activeAnchor}
        setActiveAnchor={setActiveAnchor}
        pageName={previewContext?.pageName || state.activePage}
        onCopy={(item, colKey, pageName) => {
          const activeCopyCfg = state.pageConfigs[state.activePage]?.copyBoxConfig;
          if (activeCopyCfg) {
            if (activeCopyCfg.box1.sourcePage === pageName && activeCopyCfg.box1.sourceColumn === colKey) {
              setBox1Value(item);
            }
            if (activeCopyCfg.box2.sourcePage === pageName && activeCopyCfg.box2.sourceColumn === colKey) {
              setBox2Value(item);
            }
          }
        }}
        getImageUrl={getImageUrl}
      />

      <ReorderPagesModal 
        isOpen={modals.reorderPages}
        onClose={closeAllModals}
        pages={state.pages}
        onReorder={(newPages) => {
          setState(prev => ({ ...prev, pages: newPages }));
        }}
      />

      <ReorderSearchBarsModal 
        isOpen={modals.reorderSearchBars}
        onClose={() => {
          closeAllModals();
          setReturnToSettings(false);
        }}
        onBack={() => {
          closeAllModals();
          toggleModal('activePageSettings', true);
          setReturnToSettings(false);
        }}
        order={activeConfig.searchBarOrder || ['primary', 'secondary']}
        activePageName={state.activePage}
        secondaryPageName={activeConfig.secondarySearchPage || ''}
        onReorder={(newOrder) => {
          setState(prev => ({
            ...prev,
            pageConfigs: {
              ...prev.pageConfigs,
              [state.activePage]: {
                ...prev.pageConfigs[state.activePage],
                searchBarOrder: newOrder
              }
            }
          }));
        }}
      />

      <ExcelImportModal
        isOpen={modals.excelImport}
        onClose={closeAllModals}
        onBack={() => {
          closeAllModals();
          toggleModal('activePageSettings', true);
        }}
        existingColumns={activeConfig.columns}
        existingRows={activeRows}
        importRows={excelImportData.rows}
        setImportRows={(rows) => setExcelImportData(prev => ({ ...prev, rows }))}
        headers={excelImportData.headers}
        setHeaders={(headers) => setExcelImportData(prev => ({ ...prev, headers }))}
        onImport={async (newRows, newColumns) => {
          const currentCols = state.pageConfigs[state.activePage].columns;
          const updatedCols = [...currentCols, ...newColumns];
          const updatedConfig = {
            ...state.pageConfigs[state.activePage],
            columns: updatedCols
          };
          const updatedRows = [...(state.pageRows[state.activePage] || []), ...newRows];

          try {
            await Promise.all([
              fetch(`/api/pageConfigs/${encodeURIComponent(state.activePage)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: updatedConfig })
              }),
              fetch(`/api/pageRows/${encodeURIComponent(state.activePage)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: updatedRows })
              })
            ]);

            setState(prev => ({
              ...prev,
              pageConfigs: {
                ...prev.pageConfigs,
                [state.activePage]: updatedConfig
              },
              pageRows: {
                ...prev.pageRows,
                [state.activePage]: updatedRows
              }
            }));
            toast('Excel data imported successfully');
          } catch (err) {
            console.error(err);
            toast('Failed to import Excel data to database');
          }
        }}
        getImageUrl={getImageUrl}
      />

      <ExcelExportModal
        isOpen={modals.excelExport}
        onClose={closeAllModals}
        onBack={() => {
          closeAllModals();
          toggleModal('activePageSettings', true);
        }}
        pageName={state.activePage}
        columns={activeConfig.columns}
        rows={activeRows}
      />

      <GlobalCopyBoxesSettingsModal
        isOpen={modals.globalCopyBoxesSettings}
        onClose={closeAllModals}
        state={state}
        onSave={async (settings) => {
          try {
            const updatedConfig = { ...state.pageConfigs[state.activePage], copyBoxConfig: settings };
            await fetch(`/api/pageConfigs/${encodeURIComponent(state.activePage)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ config: updatedConfig })
            });
            setState(prev => ({
              ...prev,
              pageConfigs: {
                ...prev.pageConfigs,
                [state.activePage]: updatedConfig
              }
            }));
            toast('Page Copy Boxes Settings saved');
          } catch (err) {
            console.error(err);
            toast('Failed to save settings to database');
          }
        }}
      />

      <RowNoResizeModal
        isOpen={modals.rowNoResize}
        onClose={closeAllModals}
        state={state}
        onSave={async (width) => {
          try {
            await fetch('/api/settings', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ globalRowNoWidth: width, maxSearchHistory: maxSearchHistory })
            });
            setState(prev => ({ ...prev, globalRowNoWidth: width }));
            toast('Row No. Resize Setting saved');
          } catch (err) {
            console.error(err);
            toast('Failed to save settings to database');
          }
        }}
      />

      <DuplicateFinderModal 
        isOpen={isDupModalOpen} 
        onClose={() => {
          setIsDupModalOpen(false);
          setReturnToSettings(false);
        }} 
        onBack={() => {
          setIsDupModalOpen(false);
          toggleModal('activePageSettings', true);
        }}
        rows={activeRows}
        columns={activeConfig.columns}
        onDeleteRow={(rowId) => {
          setConfirmationModal({
            isOpen: true,
            title: "Confirm Row Deletion",
            message: "Are you sure you want to delete this row? This action cannot be undone.",
            onConfirm: () => {
              handleDeleteRow(rowId);
            }
          });
        }} 
      />

      {hoveredImage && createPortal(
        <div 
          className="fixed z-[9999] pointer-events-none bg-white p-1 rounded-lg shadow-2xl border border-gray-200"
          style={{
            left: hoveredImage.x + 20,
            top: Math.min(hoveredImage.y - 100, window.innerHeight - 320),
            width: '350px',
            height: '350px'
          }}
        >
          <img 
            src={getImageUrl(hoveredImage.url)} 
            alt="Hover Preview" 
            className="w-full h-full object-contain"
          />
        </div>,
        document.body
      )}

      {isImporting && (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm text-white">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Processing... {importProgress.percent !== null && `${importProgress.percent}%`}
            </h2>
            <p className="text-gray-500 text-center mb-4">
              {importProgress.message}
            </p>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              {importProgress.percent !== null ? (
                <div 
                  className="bg-blue-500 h-full transition-all duration-300" 
                  style={{ width: `${importProgress.percent}%` }}
                ></div>
              ) : (
                <div className="bg-blue-500 h-full animate-[shimmer_2s_infinite]"></div>
              )}
            </div>
            <p className="mt-4 text-xs text-amber-600 font-medium bg-amber-50 px-3 py-1 rounded-full">
              Please do not close this window
            </p>
          </div>
        </div>
      )}

      {showHistoryLimitModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-5 rounded-lg shadow-2xl max-w-sm w-full m-4">
            <h3 className="text-base font-bold text-[#2b579a] mb-2">🕒 Search History Limit</h3>
            <p className="text-xs text-gray-600 mb-4">Set maximum undo/redo states to keep in memory.</p>
            <input type="number" min="1" max="500" className="w-full border border-gray-300 rounded p-2 text-sm mb-4" value={tempHistoryLimit} onChange={(e) => setTempHistoryLimit(Number(e.target.value))} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowHistoryLimitModal(false)}>Cancel</Button>
              <Button variant="green" onClick={async () => {
                try {
                  await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ globalRowNoWidth: state.globalRowNoWidth, maxSearchHistory: tempHistoryLimit }) });
                  setMaxSearchHistory(tempHistoryLimit); setShowHistoryLimitModal(false); toast('Limit updated to ' + tempHistoryLimit);
                } catch (err) { toast('Failed to save settings'); }
              }}>Save Limit</Button>
            </div>
          </div>
        </div>
      )}

      {clearDBModal.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-lg shadow-2xl max-w-sm w-full border border-red-200 m-4">
            <h3 className="text-lg font-bold text-red-600 mb-2">⚠️ Danger: Clear Database</h3>
            <p className="text-sm text-gray-700 mb-5 font-medium min-h-[60px]">
              {clearDBModal.step === 1 && "Step 1/3: Are you sure you want to completely wipe all pages, columns, and data? This cannot be undone."}
              {clearDBModal.step === 2 && "Step 2/3: Are you ABSOLUTELY sure? All your uploaded images and rows will be permanently deleted from the server."}
              {clearDBModal.step === 3 && "Final Step 3/3: This is your last warning. Click Yes to factory reset the entire software."}
            </p>
            <div className="flex gap-3">
              {clearDBModal.yesLeft ? (
                <>
                  <button
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded font-bold text-sm transition-colors border-0 cursor-pointer shadow-sm"
                    onClick={() => {
                      if (clearDBModal.step < 3) {
                        setClearDBModal({ isOpen: true, step: clearDBModal.step + 1, yesLeft: Math.random() > 0.5 });
                      } else {
                        setClearDBModal({ ...clearDBModal, isOpen: false });
                        handleClearEntireDB();
                      }
                    }}
                  >
                    Yes, Clear It
                  </button>
                  <button
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded font-bold text-sm transition-colors border-0 cursor-pointer shadow-sm"
                    onClick={() => setClearDBModal({ isOpen: false, step: 1, yesLeft: true })}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded font-bold text-sm transition-colors border-0 cursor-pointer shadow-sm"
                    onClick={() => setClearDBModal({ isOpen: false, step: 1, yesLeft: true })}
                  >
                    Cancel
                  </button>
                  <button
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded font-bold text-sm transition-colors border-0 cursor-pointer shadow-sm"
                    onClick={() => {
                      if (clearDBModal.step < 3) {
                        setClearDBModal({ isOpen: true, step: clearDBModal.step + 1, yesLeft: Math.random() > 0.5 });
                      } else {
                        setClearDBModal({ ...clearDBModal, isOpen: false });
                        handleClearEntireDB();
                      }
                    }}
                  >
                    Yes, Clear It
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {isSalePromptOpen && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-[350px] shadow-2xl">
            <h3 className="text-lg font-bold mb-1 text-[#2b579a]">Enter Sale Date</h3>
            <p className="text-xs text-gray-500 mb-4">Enter custom duration (e.g., "24-25 April")</p>
            <input autoFocus className="w-full border-2 border-[#d7dde1] p-2.5 rounded-md mb-5 outline-none focus:border-[#2b579a] text-sm font-semibold" placeholder="e.g. 24-25 April" value={customSaleName} onChange={(e) => setCustomSaleName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSaleColumn()} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsSalePromptOpen(false)} className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-bold text-sm">Cancel</button>
              <button onClick={handleAddSaleColumn} className="px-4 py-1.5 bg-[#2b579a] hover:bg-[#1a3c6d] text-white rounded font-bold text-sm">Create Column</button>
            </div>
          </div>
        </div>
      )}

      {/* --- ARCHIVE COLUMNS MODAL --- */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-[450px] shadow-2xl">
            <h3 className="text-lg font-bold mb-1 text-[#2b579a]">Archive Columns</h3>
            <p className="text-xs text-gray-500 mb-3">Manually hide or show your custom sale date columns.</p>
            
            {/* Search and Bulk Actions */}
            <div className="mb-3 flex flex-col gap-2">
              <input 
                type="text" 
                autoFocus
                placeholder="🔍 Search dates or columns..." 
                className="w-full border-2 border-[#d7dde1] p-2 rounded-md outline-none focus:border-[#2b579a] text-sm font-semibold transition-colors"
                value={archiveSearchQuery}
                onChange={(e) => setArchiveSearchQuery(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => handleBulkArchiveToggle(false)} className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded text-xs font-bold transition-colors border border-green-200 shadow-sm">👁️ Show All</button>
                <button onClick={() => handleBulkArchiveToggle(true)} className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs font-bold transition-colors border border-red-200 shadow-sm">🙈 Hide All</button>
              </div>
            </div>
            
            {/* Columns List */}
            <div className="max-h-[300px] overflow-y-auto border-2 border-gray-100 rounded-md p-2 mb-4 bg-gray-50">
              {activeConfig?.columns
                .filter(c => c.type === 'sale_tracker' && c.name.toLowerCase().includes(archiveSearchQuery.toLowerCase()))
                .map(col => (
                <div key={col.key} className="flex justify-between items-center p-2.5 border-b border-gray-200 last:border-b-0 bg-white mb-1 rounded shadow-sm hover:bg-gray-50 transition-colors">
                  <span className="text-sm font-semibold text-gray-700">
                    {renderHighlightedText(col.name, archiveSearchQuery)}
                  </span>
                  <button 
                    onClick={() => handleToggleColumnArchive(col.key, !!col.archived)}
                    className={`px-3 py-1 rounded text-xs font-bold transition-colors ${col.archived ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                  >
                    {col.archived ? '👁️ Show' : '🙈 Hide'}
                  </button>
                </div>
              ))}
              {activeConfig?.columns.filter(c => c.type === 'sale_tracker').length === 0 && (
                 <div className="text-sm text-gray-500 text-center p-4 font-semibold">No custom sale columns found yet.</div>
              )}
              {activeConfig?.columns.filter(c => c.type === 'sale_tracker' && c.name.toLowerCase().includes(archiveSearchQuery.toLowerCase())).length === 0 && archiveSearchQuery !== "" && (
                 <div className="text-sm text-red-500 text-center p-4 font-semibold">No columns match your search "{archiveSearchQuery}".</div>
              )}
            </div>
            
            <div className="flex justify-end">
              <button 
                onClick={() => { setIsArchiveModalOpen(false); setArchiveSearchQuery(""); }} 
                className="px-5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-bold text-sm transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
