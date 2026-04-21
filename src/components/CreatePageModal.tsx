import React, { useState } from 'react';
import { Button, Input, Select, Modal } from './ui';
import { ColumnType, Column, PageConfig } from '../types';
import { useToast } from './ToastProvider';
import { Trash2, Plus, Wand2 } from 'lucide-react';

export const CreatePageModal = ({
  isOpen,
  onClose,
  onCreate,
  existingPages
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, columns: Column[]) => void;
  existingPages: string[];
}) => {
  const [name, setName] = useState('');
  const [columns, setColumns] = useState<{ name: string; type: ColumnType }[]>([{ name: '', type: 'text' }]);
  const [magicPasteText, setMagicPasteText] = useState('');
  const { toast } = useToast();

  const processMagicPaste = () => {
    if (!magicPasteText.trim()) return;

    const newColNames = magicPasteText.split(/[\t\n\r]+/).map(s => s.trim()).filter(Boolean);
    
    if (newColNames.length > 0) {
      const newCols = [...columns];
      
      if (newCols.length === 1 && !newCols[0].name.trim()) {
        newCols.pop();
      }

      newColNames.forEach(colName => {
        newCols.push({ name: colName, type: 'text' });
      });

      setColumns(newCols);
      setMagicPasteText('');
      toast('✨ Magic Paste applied successfully!');
    }
  };

  const handleAddColumn = () => setColumns([...columns, { name: '', type: 'text' }]);
  const handleRemoveColumn = (index: number) => setColumns(columns.filter((_, i) => i !== index));
  const handleUpdateColumn = (index: number, field: 'name' | 'type', value: string) => {
    const newCols = [...columns];
    newCols[index] = { ...newCols[index], [field]: value };
    setColumns(newCols);
  };

  const handleCreate = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return toast('Page name required');
    if (existingPages.includes(trimmedName)) return toast('Page already exists');

    if (columns.some(c => !c.name.trim())) return toast('Please fill all column names or delete empty rows');

    const validCols = columns.filter(c => c.name.trim());
    const lowerNames = validCols.map(c => c.name.toLowerCase());
    if (new Set(lowerNames).size !== lowerNames.length) return toast('Duplicate column names are not allowed');

    const finalCols: Column[] = validCols.map((c, i) => ({
      key: `col_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`,
      name: c.name.trim(),
      type: c.type,
      locked: false,
      movable: true,
      copyPerItem: c.type === 'text_with_copy_button',
      multiInput: c.type === 'text_with_copy_button'
    }));

    onCreate(trimmedName, finalCols);
    setName('');
    setColumns([{ name: '', type: 'text' }]);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="➕ Create New Page">
      <div className="mb-3">
        <label className="block text-xs font-bold text-gray-600 mb-1">Page Name</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Create Page Name" />
      </div>

      <div className="mb-4 border border-purple-200 bg-purple-50 rounded-md p-2.5">
        <div className="text-xs text-purple-800 font-bold mb-1 flex items-center gap-1">
          <Wand2 size={14} /> Magic Paste Columns
        </div>
        <div className="text-[11px] text-purple-600 mb-2 leading-snug">
          Copy column headers from Excel/Sheets and paste them here to quickly create columns. You can manually adjust their types below.
        </div>
        <div className="flex gap-2 items-stretch">
          <textarea 
            className="flex-1 h-16 border border-purple-300 rounded p-1.5 text-xs focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            placeholder="Paste your column names here (tab or newline separated)..."
            value={magicPasteText}
            onChange={(e) => setMagicPasteText(e.target.value)}
          />
          <Button 
            variant="blue" 
            onClick={processMagicPaste}
            className="h-16 px-4 whitespace-nowrap"
          >
            <Wand2 size={14} className="mr-1" /> Process Magic Paste
          </Button>
        </div>
      </div>

      <div className="text-xs font-bold text-[#607d8b] mb-2">Define columns (no hardcoding):</div>
      <div className="space-y-2 mb-3">
        {columns.map((col, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center border border-[#e1e7ea] rounded-md p-2 bg-[#fcfdfe]">
            <Input value={col.name} onChange={e => handleUpdateColumn(i, 'name', e.target.value)} placeholder="Column name" />
            <Select value={col.type} onChange={e => handleUpdateColumn(i, 'type', e.target.value as ColumnType)}>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="dropdown">Dropdown</option>
              <option value="multi_select">Multi-select</option>
              <option value="checkbox">Checkbox</option>
              <option value="image">Image</option>
              <option value="file">File</option>
              <option value="formula">Formula</option>
              <option value="relation">Relation/Lookup</option>
              <option value="multi_text">Multi Text</option>
              <option value="text_with_copy_button">Text With Copy Button</option>
            </Select>
            <Button variant="red" onClick={() => handleRemoveColumn(i)}><Trash2 size={14} /> Delete</Button>
          </div>
        ))}
      </div>
      <Button variant="blue" onClick={handleAddColumn} className="mb-3"><Plus size={14} /> Add Column</Button>
      
      <div className="mt-2 max-h-[170px] overflow-auto border border-gray-200 rounded bg-white p-1.5">
        {columns.length === 0 ? (
          <div className="text-[11px] text-[#90a4ae]">No custom columns added yet. Only Row No. will be created by default.</div>
        ) : (
          columns.map((c, i) => (
            <div key={i} className="text-[11px] p-1 border-b border-gray-100">
              <b>{i + 1}. {c.name || <span className="text-orange-600">(empty name)</span>}</b> <span className="text-[#607d8b]">({c.type})</span>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2 sticky bottom-0 bg-white py-3 border-t border-gray-100 z-10 -mb-1">
        <Button variant="red" onClick={onClose}>Back to Workspace</Button>
        <Button variant="green" onClick={handleCreate}>Create Page</Button>
      </div>
    </Modal>
  );
};
