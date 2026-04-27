import React, { useState, useRef } from 'react';
import { Button, Input, Modal } from './ui';
import { Column, PageConfig } from '../types';
import { useToast } from './ToastProvider';
import { Edit, Trash2, Plus, GripVertical, RefreshCw, ArrowUpDown, Lock, Sliders } from 'lucide-react';
import { ColumnSortSettingsModal } from './ColumnSortSettingsModal';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

export const ActivePageSettingsModal = ({
  isOpen,
  onClose,
  activePage,
  pageConfig,
  onSave,
  onRenamePage,
  onCreateColumn,
  onAddRow,
  onEditColumn,
  onDeletePage,
  onReorderSearchBars,
  onImportExcel,
  onExportExcel,
  onImportPageJson,
  onExportPageJson,
  onFindDuplicates,
  onClearPageData,
  onCreateTracker,
  onConfigureCopyBoxes,
  existingPages,
  setConfirmationModal
}: {
  isOpen: boolean;
  onClose: () => void;
  activePage: string;
  pageConfig: PageConfig | null;
  onSave: (config: PageConfig, closeModal?: boolean) => void;
  onRenamePage: () => void;
  onCreateColumn: () => void;
  onAddRow: () => void;
  onEditColumn: (column: Column) => void;
  onDeletePage: () => void;
  onReorderSearchBars: () => void;
  onImportExcel: () => void;
  onExportExcel: () => void;
  onImportPageJson: (file: File) => void;
  onExportPageJson: () => void;
  onFindDuplicates: () => void;
  onClearPageData: () => void;
  onCreateTracker?: (sourcePage: string) => void;
  onConfigureCopyBoxes: () => void;
  existingPages: string[];
  setConfirmationModal: (modal: { isOpen: boolean, title?: string, message?: string, onConfirm: () => void } | null) => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rowReorder, setRowReorder] = useState(pageConfig?.rowReorderEnabled || false);
  const [hoverPreview, setHoverPreview] = useState(pageConfig?.hoverPreviewEnabled || false);
  const [independentSearchBars, setIndependentSearchBars] = useState(pageConfig?.independentSearchBars ?? true);
  const [rowHeight, setRowHeight] = useState(pageConfig?.rowHeight || 100);
  const [rowHeightInput, setRowHeightInput] = useState(String(pageConfig?.rowHeight || 100));
  const [localColumns, setLocalColumns] = useState<Column[]>(pageConfig?.columns || []);
  const [secondarySearchPage, setSecondarySearchPage] = useState<string>(pageConfig?.secondarySearchPage || '');
  const [sortSettingsColumn, setSortSettingsColumn] = useState<Column | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setRowReorder(pageConfig?.rowReorderEnabled || false);
      setHoverPreview(pageConfig?.hoverPreviewEnabled || false);
      setIndependentSearchBars(pageConfig?.independentSearchBars ?? true);
      const initialHeight = pageConfig?.rowHeight || 100;
      setRowHeight(initialHeight);
      setRowHeightInput(String(initialHeight));
      setLocalColumns(pageConfig?.columns || []);
      setSecondarySearchPage(pageConfig?.secondarySearchPage || '');
    }
  }, [isOpen, pageConfig]);

  const handleSaveSortSettings = (updatedCol: Column) => {
    const cols = localColumns.map(c => c.key === updatedCol.key ? updatedCol : c);
    setLocalColumns(cols);
    saveConfig({ columns: cols }, false);
  };

  const saveConfig = (updatedProps: Partial<PageConfig>, closeModal?: boolean) => {
    if (pageConfig) {
      onSave({ 
        ...pageConfig, 
        rowHeight: rowHeight, 
        rowReorderEnabled: rowReorder, 
        hoverPreviewEnabled: hoverPreview, 
        independentSearchBars: independentSearchBars,
        secondarySearchPage: secondarySearchPage || undefined,
        columns: localColumns,
        ...updatedProps 
      }, closeModal);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const sourceIdx = result.source.index;
    const destIdx = result.destination.index;
    if (sourceIdx === destIdx) return;

    const cols = [...localColumns];
    const draggedCol = cols[sourceIdx];
    const targetCol = cols[destIdx];

    if (draggedCol.movable === false || targetCol.movable === false) return;

    const [reorderedItem] = cols.splice(sourceIdx, 1);
    cols.splice(destIdx, 0, reorderedItem);

    setLocalColumns(cols);
    saveConfig({ columns: cols }, false);
  };

  const handleManualReorder = (colKey: string, newPosStr: string) => {
    const newPos = parseInt(newPosStr, 10);
    if (isNaN(newPos)) return;

    const cols = [...localColumns];
    const currentIdx = cols.findIndex(c => c.key === colKey);
    if (currentIdx === -1) return;

    // Position 1 is locked (index 0). Movable columns start at index 1 (Position 2).
    let targetIdx = newPos - 1;
    if (targetIdx < 1) targetIdx = 1;
    if (targetIdx >= cols.length) targetIdx = cols.length - 1;

    if (currentIdx === targetIdx) return;

    const [movedCol] = cols.splice(currentIdx, 1);
    cols.splice(targetIdx, 0, movedCol);

    setLocalColumns(cols);
    saveConfig({ columns: cols }, false);
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); }} title={`⚙️ Active Page Settings ${activePage ? `(${activePage})` : ''}`} width="min(900px, 96vw)">
      <div className="text-xs text-[#607d8b] mb-2 font-bold">
        Page: <span className="text-gray-800">{activePage || 'No page selected'}</span>
      </div>
      <div className="border border-gray-200 rounded-md p-2.5 bg-gray-50 mb-2.5">
        <label className="flex items-center justify-between gap-2.5 m-0 cursor-pointer">
          <span className="text-[13px] text-[#37474f] font-bold">Row Height</span>
          <div className="flex items-center gap-2">
            <input 
              type="range" 
              min="40" 
              max="300" 
              value={rowHeight}
              className="w-32"
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                setRowHeight(val);
                setRowHeightInput(String(val));
                saveConfig({ rowHeight: val }, false);
              }} 
            />
            <Input 
              type="number" 
              min="40" 
              max="300" 
              value={rowHeightInput}
              className="w-16 text-xs p-1"
              onChange={e => {
                const rawVal = e.target.value;
                setRowHeightInput(rawVal);
                
                const val = parseInt(rawVal, 10);
                if (!isNaN(val) && val >= 40 && val <= 300) {
                  setRowHeight(val);
                  saveConfig({ rowHeight: val }, false);
                }
              }} 
            />
          </div>
        </label>
        <div className="mt-2 text-[11px] text-[#78909c] leading-snug">
          Adjust the global height of all rows on this page (40-300px).
        </div>
      </div>
      <div className="border border-gray-200 rounded-md p-2.5 bg-gray-50 mb-2.5">
        <label className="flex items-center justify-between gap-2.5 m-0 cursor-pointer">
          <span className="text-[13px] text-[#37474f] font-bold">Row Reorder</span>
          <input 
            type="checkbox" 
            className="scale-125" 
            checked={rowReorder} 
            onChange={e => {
              const checked = e.target.checked;
              setRowReorder(checked);
              saveConfig({ rowReorderEnabled: checked }, false);
            }} 
          />
        </label>
        <div className="mt-2 text-[11px] text-[#78909c] leading-snug">
          Enable this to unlock single-row and multi-row move features. Disable it to prevent accidental row movement.
        </div>
      </div>
      <div className="border border-gray-200 rounded-md p-2.5 bg-gray-50 mb-2.5">
        <label className="flex items-center justify-between gap-2.5 m-0 cursor-pointer">
          <span className="text-[13px] text-[#37474f] font-bold">Hover Preview Image</span>
          <input 
            type="checkbox" 
            className="scale-125" 
            checked={hoverPreview} 
            onChange={e => {
              const checked = e.target.checked;
              setHoverPreview(checked);
              saveConfig({ hoverPreviewEnabled: checked }, false);
            }} 
          />
        </label>
        <div className="mt-2 text-[11px] text-[#78909c] leading-snug">
          When enabled, hovering over an image cell will show a larger preview of the image.
        </div>
      </div>
      <div className="border border-gray-200 rounded-md p-2.5 bg-gray-50 mb-2.5">
        <label className="flex items-center justify-between gap-2.5 m-0 cursor-pointer">
          <span className="text-[13px] text-[#37474f] font-bold">Link Secondary Search Page</span>
          <select 
            className="border border-gray-300 rounded p-1 text-xs"
            value={secondarySearchPage}
            onChange={e => {
              const val = e.target.value;
              setSecondarySearchPage(val);
              saveConfig({ secondarySearchPage: val || undefined }, false);
            }}
          >
            <option value="">None</option>
            {existingPages.filter(p => p !== activePage).map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        {secondarySearchPage && (
          <Button variant="dark" className="mt-2 w-full justify-center" onClick={onReorderSearchBars}>
            <RefreshCw size={14} /> 🔄 Reorder Search Bars
          </Button>
        )}
        <div className="mt-2 text-[11px] text-[#78909c] leading-snug">
          Select another page to display a secondary search bar and view its data below this page's data.
        </div>
      </div>
      <div className="border border-gray-200 rounded-md p-2.5 bg-gray-50 mb-2.5">
        <label className="flex items-center justify-between gap-2.5 m-0 cursor-pointer">
          <span className="text-[13px] text-[#37474f] font-bold">Independent Search Bars</span>
          <input 
            type="checkbox" 
            className="scale-125" 
            checked={independentSearchBars} 
            onChange={e => {
              const checked = e.target.checked;
              setIndependentSearchBars(checked);
              saveConfig({ independentSearchBars: checked }, false);
            }} 
          />
        </label>
        <div className="mt-2 text-[11px] text-[#78909c] leading-snug">
          When enabled, typing in one search bar will not clear the text in the other search bar.
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-[#2b579a]">📦 Page Copy Boxes</p>
            <p className="text-[10px] text-gray-500 font-semibold leading-tight mt-0.5">Enable and configure combination copy boxes specific to this page.</p>
          </div>
          <input 
            type="checkbox" 
            className="w-5 h-5 cursor-pointer accent-[#2b579a]"
            checked={pageConfig?.showCopyBoxes !== false} 
            onChange={(e) => saveConfig({ showCopyBoxes: e.target.checked }, false)}
          />
        </div>
        {pageConfig?.showCopyBoxes !== false && (
          <Button variant="outline" className="w-full text-xs py-1.5 mt-1 border-[#2b579a] text-[#2b579a] hover:bg-blue-50" onClick={onConfigureCopyBoxes}>
            ⚙️ Configure Copy Boxes for this Page
          </Button>
        )}
      </div>

      {!pageConfig?.isTrackerPage && onCreateTracker && (
        <div className="mt-4 border-t border-[#eceff1] pt-3 mb-3">
          <div className="text-[11px] font-bold text-[#217346] mb-1.5 uppercase tracking-wide flex items-center gap-1">📦 Smart Inventory Tracker</div>
          <p className="text-[11px] text-gray-600 mb-2 leading-tight">Create a linked Live Tracker page with a 100% exact copy of current columns and data.</p>
          <Button variant="green" className="w-full text-xs py-1.5" onClick={() => { onCreateTracker(activePage); onClose(); }}>
             ⚡ Create Linked Live Tracker
          </Button>
        </div>
      )}

      <div className="border border-gray-200 rounded-md p-2.5 bg-gray-50">
        <div className="flex gap-2 mb-2">
          <Button variant="blue" className="flex-1 justify-center" onClick={onCreateColumn}><Plus size={14} /> Create Column</Button>
          <Button variant="green" className="flex-1 justify-center" onClick={onAddRow}>🧾 Add Row</Button>
        </div>
        
        { (
          <div className="flex gap-2 mb-2">
            <Button variant="dark" className="flex-1 justify-center" onClick={onRenamePage}><Edit size={14} /> Rename Page</Button>
            <Button variant="red" className="flex-1 justify-center" onClick={() => {
              setConfirmationModal({
                isOpen: true,
                title: "Confirm Page Deletion",
                message: `Are you sure you want to delete "${activePage}"? This cannot be undone.`,
                onConfirm: () => {
                  onDeletePage();
                  onClose();
                }
              });
            }}><Trash2 size={14} /> Delete Page</Button>
          </div>
        )}

        <div className="flex gap-2 mb-2">
          <Button variant="green" className="flex-1 justify-center" onClick={onImportExcel}>📥 Import Excel</Button>
          <Button variant="blue" className="flex-1 justify-center" onClick={onExportExcel}>📤 Export Excel</Button>
        </div>

        <div className="flex gap-2 mb-2">
          <Button variant="outline" className="flex-1 justify-center" onClick={() => fileInputRef.current?.click()}>📥 Import Page JSON</Button>
          <input 
            type="file" 
            accept=".json" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onImportPageJson(e.target.files[0]);
                e.target.value = ''; // Reset input
              }
            }} 
          />
          <Button variant="dark" className="flex-1 justify-center" onClick={onExportPageJson}>💾 Export Page JSON</Button>
        </div>

        <div className="flex gap-2 mb-2">
          <Button variant="outline" className="flex-1 justify-center text-orange-600 border-orange-600 hover:bg-orange-50" onClick={onFindDuplicates}>
            🔍 Find Duplicates
          </Button>
          <Button variant="outline" className="flex-1 justify-center text-red-600 border-red-600 hover:bg-red-50" onClick={() => {
            setConfirmationModal({
              isOpen: true,
              title: "Confirm Clear Active Page Data",
              message: "Are you sure you want to permanently delete ALL rows on this page? This action cannot be undone.",
              onConfirm: () => {
                onClearPageData();
                onClose();
              }
            });
          }}>
            <Trash2 size={14} /> Clear Active Page All Data 
          </Button>
        </div>

        <div className="mt-2 text-[11px] text-[#78909c] leading-snug">
          New columns will be added to the active page. <b>Row No.</b> always remains first and locked. You can drag and drop columns here to reorder them.
        </div>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="columns-droppable">
            {(provided) => (
              <div 
                className="mt-2.5 max-h-[300px] overflow-auto border border-gray-200 rounded bg-white p-1.5"
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {localColumns.length === 0 ? (
                  <div className="text-[11px] text-[#90a4ae]">No columns yet.</div>
                ) : (
                  localColumns.map((c, i) => (
                    // @ts-ignore
                    <Draggable key={c.key} draggableId={c.key} index={i} isDragDisabled={c.movable === false}>
                      {(provided, snapshot) => (
                        <div 
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex justify-between items-center text-[14px] p-1 border-b border-gray-100 ${c.movable !== false ? 'hover:bg-gray-50' : ''} ${snapshot.isDragging ? 'bg-white shadow-lg rounded ring-1 ring-blue-500 z-50' : ''}`}
                          style={provided.draggableProps.style}
                        >
                          <div className="flex items-center gap-2">
                            {c.movable !== false ? (
                              <>
                                <input 
                                  type="number" 
                                  min={2} 
                                  max={localColumns.length} 
                                  value={i + 1}
                                  onChange={(e) => handleManualReorder(c.key, e.target.value)}
                                  className="w-12 text-center text-xs border border-gray-300 rounded p-1 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                  title="Type position number"
                                />
                                <div {...provided.dragHandleProps} className="text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing">
                                  <GripVertical size={16} />
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="w-12 text-center text-xs text-gray-500 bg-gray-100 border border-gray-200 rounded p-1" title="Locked column">1</div>
                                <div className="w-[16px]"></div>
                              </>
                            )}
                            <div className="flex items-center gap-1.5">
                              <b>{c.name}</b> <span className="text-[#607d8b]">({c.type})</span>
                              {c.sortEnabled && c.key !== 'sr' && <ArrowUpDown size={14} className="text-blue-500" title="Sorting Enabled" />}
                              {c.sortLocked && c.key !== 'sr' && <Lock size={14} className="text-gray-500" title="Sorting Locked" />}
                              {c.sortPriority && c.key !== 'sr' && <span className="text-[10px] font-bold px-1 rounded bg-blue-100 text-blue-700" title={`Priority ${c.sortPriority}`}>P{c.sortPriority}</span>}
                              {c.locked && ' • Locked'}
                              {c.type === 'text_with_copy_button' && ' • Multi input + per-item copy'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {c.key !== 'sr' && (
                              <button 
                                className="border-0 bg-transparent cursor-pointer text-[#607d8b] hover:text-gray-800 p-1 flex items-center justify-center"
                                onClick={() => setSortSettingsColumn(c)}
                                title="Sort Settings"
                              >
                                <Sliders size={16} />
                              </button>
                            )}
                            {!c.locked && (
                              <div className="flex items-center gap-1">
                                <button 
                                  className="border-0 bg-transparent cursor-pointer text-[#2b579a] hover:text-blue-800 p-1 flex items-center justify-center"
                                  onClick={() => onEditColumn(c)}
                                  title="Edit Column"
                                >
                                  <Edit size={16} />
                                </button>
                                <button 
                                  className="border-0 bg-transparent cursor-pointer text-red-600 hover:text-red-800 p-1 flex items-center justify-center"
                                  onClick={() => {
                                    setConfirmationModal({
                                      isOpen: true,
                                      title: "Confirm Column Deletion",
                                      message: `Are you sure you want to delete column "${c.name}"? This cannot be undone.`,
                                      onConfirm: () => {
                                        const cols = localColumns.filter(col => col.key !== c.key);
                                        setLocalColumns(cols);
                                        saveConfig({ columns: cols }, false);
                                      }
                                    });
                                  }}
                                  title="Delete Column"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
      <ColumnSortSettingsModal
        isOpen={!!sortSettingsColumn}
        onClose={() => setSortSettingsColumn(null)}
        column={sortSettingsColumn}
        onSave={handleSaveSortSettings}
      />
      <div className="mt-4 flex justify-end gap-2 sticky bottom-0 bg-white py-3 border-t border-gray-100 z-10 -mb-1">
        <Button variant="dark" onClick={onClose}>Back to Workspace</Button>
      </div>
    </Modal>
  );
};
