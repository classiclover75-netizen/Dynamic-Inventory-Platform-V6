import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, Modal } from './ui';
import { Column, RowData } from '../types';
import { useToast } from './ToastProvider';
import { Trash2, Plus, Wand2, Lock, RotateCcw, Undo2, X, Copy } from 'lucide-react';

const RichTextEditor = ({ value, onChange, placeholder, minHeight = "36px", className = "" }: { value: string, onChange: (val: string) => void, placeholder?: string, minHeight?: string, className?: string }) => {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // CRITICAL FIX: Only update DOM from state if the user is NOT actively focused on this element.
    // This prevents React from forcefully resetting the caret (cursor) position upon sanitization.
    if (divRef.current && divRef.current.innerHTML !== value && document.activeElement !== divRef.current) {
      divRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    onChange(e.currentTarget.innerHTML);
  };

  const handleBlur = () => {
    // Force sync the cleaned value back to the DOM when the user leaves the field
    if (divRef.current && divRef.current.innerHTML !== value) {
      divRef.current.innerHTML = value || '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;

      const range = selection.getRangeAt(0);
      range.deleteContents();

      const br = document.createElement('br');
      const zwsp = document.createTextNode('\u200B');
      const fragment = document.createDocumentFragment();
      fragment.appendChild(br);
      fragment.appendChild(zwsp);
      range.insertNode(fragment);

      // Move selection to after the ZWSP
      range.setStartAfter(zwsp);
      range.collapse(true);

      // Crucially, ensure the Selection/Range is moved OUTSIDE of any active preceding rich-text tags
      let parent = zwsp.parentElement;
      while (parent && parent !== divRef.current) {
        if (['B', 'I', 'U', 'S', 'SPAN', 'STRONG', 'EM', 'FONT'].includes(parent.tagName)) {
          parent.after(br, zwsp);
          range.setStartAfter(zwsp);
          range.collapse(true);
        }
        parent = parent.parentElement;
      }

      selection.removeAllRanges();
      selection.addRange(range);
      onChange(e.currentTarget.innerHTML);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    const isPlainPaste = e.shiftKey || !html;

    if (!isPlainPaste) {
      document.execCommand('insertHTML', false, html);
    } else {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      selection.deleteFromDocument();
      const range = selection.getRangeAt(0);

      // Normalize: If we are at the end of a formatting tag, move out before inserting plain text
      // to prevent formatting bleed from the previous content.
      let container = range.startContainer;
      if (container.nodeType === Node.TEXT_NODE && range.startOffset === (container.textContent?.length || 0)) {
        let parent = container.parentElement;
        while (parent && parent !== divRef.current) {
          if (['B', 'I', 'U', 'S', 'SPAN', 'STRONG', 'EM', 'FONT'].includes(parent.tagName)) {
            range.setStartAfter(parent);
            range.collapse(true);
          }
          parent = parent.parentElement;
        }
      }

      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    onChange(e.currentTarget.innerHTML);
  };

  return (
    <div
      ref={divRef}
      contentEditable
      onInput={handleInput}
      onBlur={handleBlur}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      className={`w-full border border-[#cfd8dc] rounded p-1.5 text-[13px] overflow-auto focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white ${className}`}
      style={{ minHeight }}
      data-placeholder={placeholder}
    />
  );
};

export const AddRowModal = ({
  isOpen,
  onClose,
  onBack,
  backText = "Back to Active Page Settings",
  onSave,
  onDelete,
  columns,
  editingRow,
  editingRowIndex,
  activePage,
  onToggleMagicPasteColumn,
  setConfirmationModal,
  getImageUrl
}: {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  backText?: string;
  onSave: (rows: RowData[]) => void;
  onDelete?: (rowId: string) => void;
  columns: Column[];
  editingRow: RowData | null;
  editingRowIndex?: number;
  activePage: string;
  onToggleMagicPasteColumn?: (colKey: string) => void;
  setConfirmationModal: (modal: { isOpen: boolean, title?: string, message?: string, onConfirm: () => void } | null) => void;
  getImageUrl: (val: any) => string;
}) => {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<Record<string, any>[]>([{}]);
  const [magicPasteText, setMagicPasteText] = useState('');
  const [imageModes, setImageModes] = useState<Record<string, 'url' | 'file'>>({});
  const [history, setHistory] = useState<any[][]>([[{}]]);
  const [pointer, setPointer] = useState(0);
  const isUndoRedoRef = useRef(false);

  const editableCols = columns.filter(c => c.key !== 'sr');

  useEffect(() => {
    if (isOpen) {
      if (editingRow) {
        setBlocks([{ ...editingRow }]);
      } else {
        setBlocks([{}]);
      }
      setMagicPasteText('');
      // Reset history when modal opens
      setHistory([editingRow ? [{ ...editingRow }] : [{}]]);
      setPointer(0);
    }
  }, [isOpen, editingRow, columns]);

  useEffect(() => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const currentBlocksStr = JSON.stringify(blocks);
      const lastSavedStr = JSON.stringify(history[pointer]);
      if (currentBlocksStr !== lastSavedStr) {
        const newHistory = [...history.slice(0, pointer + 1), JSON.parse(currentBlocksStr)];
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory);
        setPointer(newHistory.length - 1);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [blocks]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        // Stop propagation IMMEDIATELY to prevent App.tsx background from catching it
        e.stopPropagation();

        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return; // Let browser native undo work safely isolated in the modal
        }

        e.preventDefault();
        e.shiftKey ? handleRedo() : handleUndo();
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.stopPropagation();
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        e.preventDefault();
        handleRedo();
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [isOpen, pointer, history]);

  const handleAddBlock = () => setBlocks([...blocks, {}]);
  const handleRemoveBlock = (index: number) => {
    if (blocks.length <= 1) return toast('At least one row block is required');
    setConfirmationModal({
      isOpen: true,
      title: "Confirm Block Deletion",
      message: "Are you sure you want to delete this row block? This action cannot be undone.",
      onConfirm: () => {
        setBlocks(blocks.filter((_, i) => i !== index));
      }
    });
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 KB';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  const handleUndo = () => {
    if (pointer > 0) {
      isUndoRedoRef.current = true;
      const prevVersion = history[pointer - 1];
      setBlocks(prevVersion);
      setPointer(pointer - 1);
      toast('Undo applied (Add Row)');
    }
  };

  const handleRedo = () => {
    if (pointer < history.length - 1) {
      isUndoRedoRef.current = true;
      const nextVersion = history[pointer + 1];
      setBlocks(nextVersion);
      setPointer(pointer + 1);
      toast('Redo applied (Add Row)');
    }
  };

  const handleUpdateField = (blockIndex: number, fieldKey: string, value: any) => {
    const cleanValue = (val: any): any => {
      if (typeof val === 'string') {
        // Removed <br> cleaning to allow Shift+Enter. Keep comment and nbsp cleaning.
        return val.replace(/<!--[\s\S]*?-->/g, '').replace(/&nbsp;/gi, ' ');
      }
      if (Array.isArray(val)) {
        return val.map(v => typeof v === 'string' ? v.replace(/<!--[\s\S]*?-->/g, '').replace(/&nbsp;/gi, ' ') : v);
      }
      return val;
    };
    const sanitizedValue = cleanValue(value);
    const newBlocks = [...blocks];
    newBlocks[blockIndex] = { ...newBlocks[blockIndex], [fieldKey]: sanitizedValue };
    setBlocks(newBlocks);
  };

  const compressImage = (dataUrl: string): Promise<{ data: string; size: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = dataUrl;
      img.onload = () => {
        const approxSize = dataUrl.length * 0.75;
        const MAX_WIDTH = 1200;
        if (img.width <= MAX_WIDTH && approxSize < 300 * 1024) {
          resolve({ data: dataUrl, size: Math.round(approxSize) });
          return;
        }

        const canvas = document.createElement('canvas');
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedData = canvas.toDataURL('image/jpeg', 0.8);
        // Calculate size in bytes from base64 string
        const size = Math.round((compressedData.length * 3) / 4);
        resolve({ data: compressedData, size });
      };
      img.onerror = () => resolve({ data: dataUrl, size: Math.round((dataUrl.length * 3) / 4) });
    });
  };

  const handleResetBlock = (index: number) => {
    const newBlocks = [...blocks];
    const currentBlock = newBlocks[index];
    
    const hasData = Object.keys(currentBlock).some(k => k !== '_undoData' && currentBlock[k] !== undefined && currentBlock[k] !== '');
    if (!hasData) return;

    const undoData = { ...currentBlock };
    delete undoData._undoData;
    newBlocks[index] = { _undoData: undoData };
    setBlocks(newBlocks);
  };

  const handleUndoReset = (index: number) => {
    const newBlocks = [...blocks];
    if (newBlocks[index]._undoData) {
      newBlocks[index] = { ...newBlocks[index]._undoData };
      setBlocks(newBlocks);
    }
  };

  const handleProcessMagicPaste = () => {
    if (!magicPasteText.trim()) {
      toast('Please paste some data first');
      return;
    }

    // Replace newlines inside quotes with a placeholder to prevent incorrect row splitting
    const processedText = magicPasteText.replace(/"(.*?)"/gs, (match) => {
      return match.replace(/\n/g, '___NEWLINE___');
    });

    const rows = processedText.split(/\r?\n/).filter(row => row.trim() !== '');
    const newBlocks = [...blocks];
    
    // If the first block is completely empty, we can overwrite it
    if (newBlocks.length === 1 && Object.keys(newBlocks[0]).length === 0) {
      newBlocks.pop();
    }

    const activePasteCols = columns.filter(c => c.key !== 'sr' && !c.magicPasteDisabled);

    rows.forEach((rowStr) => {
      // Split by tab and restore newlines
      const values = rowStr.split('\t').map(val => val.replace(/___NEWLINE___/g, '\n'));
      const blockData: Record<string, any> = {};
      
      activePasteCols.forEach((col, colIdx) => {
        if (colIdx < values.length) {
          let val = values[colIdx].trim();
          // Remove surrounding quotes if they exist
          val = val.replace(/^"|"$/g, '');
          
          if (col.type === 'text_with_copy_button') {
            const parts = val.split(/\r?\n/).map((part: string) => part.replace(/^"|"$/g, '').trim()).filter((part: string) => part.length > 0);
            blockData[col.key] = parts;
          } else {
            blockData[col.key] = val;
          }
        }
      });

      newBlocks.push(blockData);
    });

    setBlocks(newBlocks.length > 0 ? newBlocks : [{}]);
    setTimeout(() => setMagicPasteText(''), 150);
    toast('✨ Magic Paste applied successfully!');
  };

  const handleSave = () => {
    const preparedRows: RowData[] = [];
    let numberError = false;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const payload: RowData = { id: (editingRow && i === 0) ? editingRow.id : `${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}` };
      let hasAnyValue = false;

      for (const col of editableCols) {
        let val = block[col.key];
        
        if (col.type === 'number' && val) {
          const num = Number(val);
          if (Number.isNaN(num)) {
            numberError = true;
            continue;
          }
          val = num;
        }

        if (col.type === 'text_with_copy_button' || col.type === 'multi_text') {
          if (Array.isArray(val) && val.length > 0) hasAnyValue = true;
          else if (typeof val === 'string' && val.trim()) hasAnyValue = true;
        } else if (val !== undefined && val !== null && String(val).trim() !== '') {
          hasAnyValue = true;
        }
        
        payload[col.key] = val;
      }

      if (hasAnyValue) preparedRows.push(payload);
    }

    if (numberError) return toast('Invalid number value found in one or more rows');
    if (!preparedRows.length) return toast('Please enter at least one row with data');

    onSave(preparedRows);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} onBack={onBack} title={editingRow && editingRowIndex !== undefined && editingRowIndex >= 0 ? `📝 Edit Row Data (Row No. ${editingRowIndex + 1})` : "🧾 Add Row Data"} width="min(860px, 96vw)">
      <div className="text-xs text-[#607d8b] mb-2 font-bold">
        Active Page: <b>{activePage}</b> | Columns: <b>{editableCols.length}</b>
      </div>

      {editableCols.length > 0 && (
        <div className="mb-4 border border-purple-200 bg-purple-50 rounded-md p-2.5">
          <div className="text-xs text-purple-800 font-bold mb-1 flex items-center gap-1">
            <Wand2 size={14} /> Add Row Magic Paste Box
          </div>
          <div className="text-[11px] text-purple-600 mb-2 leading-snug">
            Copy a row (or multiple rows) from Excel/Sheets and paste it here. Uncheck columns you want to skip if you don't have data for them.
          </div>

          <div className="flex flex-wrap gap-1.5 mb-2">
            {columns.map((c, idx) => {
              const isSr = c.key === 'sr';
              if (isSr) {
                return (
                  <div 
                    key={c.key} 
                    className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-yellow-100 text-yellow-800 border-yellow-300 cursor-not-allowed"
                    title="Row No. is auto-generated"
                  >
                    <Lock size={10} /> {idx + 1}. {c.name}
                  </div>
                );
              }
              return (
              <label 
                key={c.key} 
                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded cursor-pointer border transition-colors ${
                  !c.magicPasteDisabled 
                    ? 'bg-purple-600 text-white border-purple-600' 
                    : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={!c.magicPasteDisabled} 
                  onChange={() => onToggleMagicPasteColumn?.(c.key)} 
                />
                {idx + 1}. {c.name}
              </label>
            )})}
          </div>

          <div className="text-[11px] text-purple-800 mb-1 font-bold">
            Paste order: {columns.filter(c => !c.magicPasteDisabled && c.key !== 'sr').map((c) => `${columns.findIndex(col => col.key === c.key) + 1}. ${c.name}`).join(' ➔ ') || 'No columns selected'}
          </div>

          <div className="flex gap-2">
            <textarea 
              className="flex-1 h-16 border border-purple-300 rounded p-1.5 text-xs focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              placeholder="Paste your tab-separated data here..."
              value={magicPasteText}
              onChange={(e) => setMagicPasteText(e.target.value)}
            />
            <button
              onClick={handleProcessMagicPaste}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap h-16 cursor-pointer border-0"
            >
              <Wand2 size={16} />
              <div className="text-left leading-tight">
                Process<br/>Magic Paste
              </div>
            </button>
          </div>
        </div>
      )}
      
      {editableCols.length === 0 ? (
        <div className="text-xs text-red-700 font-bold">No editable columns found. Please create columns first.</div>
      ) : (
        <div className="space-y-3">
          {blocks.map((block, i) => (
            <div key={i} className="border border-[#d7dde1] rounded-md p-2.5 bg-[#fafcfe]">
              <div className="flex justify-between items-center mb-2">
                <div className="text-xs font-bold text-[#2b579a]">Row {i + 1}</div>
                <div className="flex gap-2">
                  {block._undoData && (
                    <Button variant="orange" onClick={() => handleUndoReset(i)}><Undo2 size={14} /> Undo</Button>
                  )}
                  <Button variant="outline" onClick={() => handleResetBlock(i)}><RotateCcw size={14} /> Reset</Button>
                  <Button variant="red" onClick={() => handleRemoveBlock(i)}><Trash2 size={14} /> Delete</Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {editableCols.map(col => (
                  <div key={col.key} className="flex flex-col">
                    <label className="text-xs font-bold text-gray-600 mb-1">{col.name} ({col.type})</label>
                    {col.type === 'multi_text' ? (
                      <RichTextEditor 
                        className="w-full min-h-[90px]"
                        placeholder="One value per line (use Shift+Enter for new line)"
                        value={Array.isArray(block[col.key]) ? block[col.key].join('<br>') : block[col.key] || ''}
                        onChange={val => handleUpdateField(i, col.key, val.split(/<br\s*\/?>/i))}
                      />
                    ) : col.type === 'text_with_copy_button' ? (
                      <div className="flex flex-col gap-1">
                        {(Array.isArray(block[col.key]) && block[col.key].length > 0 ? block[col.key] : ['']).map((val: string, idx: number, arr: string[]) => {
                          const isCopyDisabled = val.startsWith('!');
                          return (
                            <div key={idx} className="flex items-center gap-1.5">
                              <div className="flex-1 relative">
                                <RichTextEditor 
                                  value={isCopyDisabled ? val.slice(1) : val} 
                                  placeholder={`Item ${idx + 1}`}
                                  className={isCopyDisabled ? "bg-gray-50 text-gray-400 italic" : ""}
                                  onChange={newVal => {
                                    const newArr = [...arr];
                                    newArr[idx] = isCopyDisabled ? '!' + newVal : newVal;
                                    handleUpdateField(i, col.key, newArr);
                                  }}
                                />
                                {isCopyDisabled && (
                                  <div className="absolute right-2 top-1.5 text-[9px] font-bold text-red-400 uppercase pointer-events-none">
                                    Copy Hidden
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newArr = [...arr];
                                    newArr[idx] = isCopyDisabled ? val.slice(1) : '!' + val;
                                    handleUpdateField(i, col.key, newArr);
                                  }}
                                  className={`p-1.5 rounded border transition-all cursor-pointer ${isCopyDisabled ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'}`}
                                  title={isCopyDisabled ? "Show Copy Button" : "Hide Copy Button"}
                                >
                                  <Copy size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (arr.length === 1) {
                                      handleUpdateField(i, col.key, ['']);
                                    } else {
                                      const newArr = arr.filter((_, k) => k !== idx);
                                      handleUpdateField(i, col.key, newArr);
                                    }
                                  }}
                                  className="p-1.5 bg-red-50 text-red-500 rounded border border-red-100 hover:bg-red-100 transition-all cursor-pointer"
                                  title="Delete this box"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        <button 
                          type="button" 
                          className="mt-1 border border-dashed border-blue-300 text-blue-700 bg-blue-50 rounded text-xs font-bold py-1 px-2 w-fit cursor-pointer"
                          onClick={() => {
                            const newArr = [...(Array.isArray(block[col.key]) ? block[col.key] : ['']), ''];
                            handleUpdateField(i, col.key, newArr);
                          }}
                        >
                          ➕ Add Another Box
                        </button>
                      </div>
                    ) : col.type === 'image' ? (
                      <div className="border border-gray-200 rounded p-2 bg-white">
                        <div className="flex items-center gap-4 mb-2">
                          <label className="flex items-center gap-1 text-xs cursor-pointer font-medium text-gray-700">
                            <input 
                              type="radio" 
                              name={`mode_${i}_${col.key}`} 
                              checked={(imageModes[`${i}_${col.key}`] || 'url') === 'url'} 
                              onChange={() => setImageModes(prev => ({ ...prev, [`${i}_${col.key}`]: 'url' }))} 
                              className="accent-blue-500"
                            />
                            URL
                          </label>
                          <label className="flex items-center gap-1 text-xs cursor-pointer font-medium text-gray-700">
                            <input 
                              type="radio" 
                              name={`mode_${i}_${col.key}`} 
                              checked={imageModes[`${i}_${col.key}`] === 'file'} 
                              onChange={() => setImageModes(prev => ({ ...prev, [`${i}_${col.key}`]: 'file' }))} 
                              className="accent-blue-500"
                            />
                            File
                          </label>
                        </div>
                        {(imageModes[`${i}_${col.key}`] || 'url') === 'url' ? (
                          <Input 
                            placeholder="https://example.com/image.jpg" 
                            value={typeof block[col.key] === 'object' ? block[col.key].data : (block[col.key] || '')} 
                            onChange={async e => {
                              const val = e.target.value;
                              handleUpdateField(i, col.key, val);
                              if (val.startsWith('http') && val.length > 10) {
                                try {
                                  const compressed = await compressImage(val);
                                  handleUpdateField(i, col.key, {
                                    data: compressed.data,
                                    rawSize: compressed.size,
                                    compressedSize: compressed.size
                                  });
                                } catch (err) {
                                  console.error("Compression failed", err);
                                }
                              }
                            }}
                          />
                        ) : (
                          <div className="flex flex-col gap-2">
                            <input 
                              type="file" 
                              id={`file-upload-${i}-${col.key}`}
                              accept="image/*" 
                              className="hidden" 
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const rawSize = file.size;
                                  const reader = new FileReader();
                                  reader.onloadend = async () => {
                                    const compressed = await compressImage(reader.result as string);
                                    handleUpdateField(i, col.key, {
                                      data: compressed.data,
                                      rawSize: rawSize,
                                      compressedSize: compressed.size
                                    });
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            <label 
                              htmlFor={`file-upload-${i}-${col.key}`}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#217346] hover:bg-[#1a5c38] text-white text-xs font-bold rounded cursor-pointer transition-colors w-max"
                            >
                              📤 Upload Image
                            </label>
                            {block[col.key] && (typeof block[col.key] === 'object' ? block[col.key].data : block[col.key]).startsWith('data:image') && (
                              <div className="text-[10px] text-gray-500 italic truncate max-w-[200px]">
                                Image selected successfully
                              </div>
                            )}
                          </div>
                        )}
                        {block[col.key] && (
                          <div className="mt-2 flex items-center gap-3 border border-gray-100 rounded p-1.5 bg-gray-50 w-fit relative">
                            <img 
                              src={getImageUrl(block[col.key])} 
                              alt="Preview" 
                              className="w-[60px] h-[60px] object-cover rounded border border-gray-200"
                              referrerPolicy="no-referrer"
                            />
                            <button 
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 border-0 cursor-pointer"
                              onClick={() => {
                                setConfirmationModal({
                                  isOpen: true,
                                  title: "Confirm Image Deletion",
                                  message: "Are you sure you want to delete this image?",
                                  onConfirm: () => {
                                    const newBlock = { ...block };
                                    newBlock[col.key] = '';
                                    setBlocks(blocks.map((b, i) => i === blocks.indexOf(block) ? newBlock : b));
                                  }
                                });
                              }}
                            >
                              <X size={12} />
                            </button>
                            <div className="flex flex-col">
                              <div className="text-[10px] text-gray-500 font-bold uppercase">Preview</div>
                              {typeof block[col.key] === 'object' && (
                                <div className="text-[9px] text-gray-400 leading-tight">
                                  Raw: {formatSize(block[col.key].rawSize)}<br/>
                                  Comp: {formatSize(block[col.key].compressedSize)}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : col.type === 'text' ? (
                      <RichTextEditor 
                        placeholder={`Enter ${col.name}`}
                        value={block[col.key] || ''}
                        onChange={val => handleUpdateField(i, col.key, val)}
                      />
                    ) : (
                      <Input 
                        type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                        placeholder={`Enter ${col.name}`}
                        value={block[col.key] || ''}
                        onChange={e => handleUpdateField(i, col.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!editingRow && (
        <Button variant="blue" onClick={handleAddBlock} className="mt-2"><Plus size={14} /> Add Row</Button>
      )}

      <div className="mt-4 flex justify-end gap-2 sticky bottom-0 bg-white py-3 border-t border-gray-100 z-10 -mb-1">
        {onBack ? (
          <Button variant="outline" onClick={onBack}>{backText}</Button>
        ) : (
          <Button variant="red" onClick={onClose}>Back to Workspace</Button>
        )}
        {editingRow && onDelete && (
          <Button 
            variant="red" 
            onClick={() => {
              setConfirmationModal({
                isOpen: true,
                title: "Confirm Row Deletion",
                message: "Are you sure you want to delete this row? This action cannot be undone.",
                onConfirm: () => {
                  onDelete(editingRow.id);
                  onClose();
                }
              });
            }}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Trash2 size={14} /> Delete Row
          </Button>
        )}
        <Button variant="green" onClick={handleSave}>{editingRow ? 'Update Row' : 'Save Rows'}</Button>
      </div>
    </Modal>
  );
};
