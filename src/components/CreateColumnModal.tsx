import React, { useState } from 'react';
import { Button, Input, Select, Modal } from './ui';
import { ColumnType, Column } from '../types';
import { useToast } from './ToastProvider';
import { Trash2, Plus } from 'lucide-react';

export const CreateColumnModal = ({
  isOpen,
  onClose,
  onBack,
  onSave,
  existingColumns
}: {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  onSave: (columns: Column[]) => void;
  existingColumns: Column[];
}) => {
  const [columns, setColumns] = useState<{ name: string; type: ColumnType }[]>([{ name: '', type: 'text' }]);
  const { toast } = useToast();

  const handleAddColumn = () => setColumns([...columns, { name: '', type: 'text' }]);
  const handleRemoveColumn = (index: number) => setColumns(columns.filter((_, i) => i !== index));
  const handleUpdateColumn = (index: number, field: 'name' | 'type', value: string) => {
    const newCols = [...columns];
    newCols[index] = { ...newCols[index], [field]: value };
    setColumns(newCols);
  };

  const handleSave = () => {
    if (columns.length === 0) return toast('Please add at least one column row');
    if (columns.some(c => !c.name.trim())) return toast('Please fill all column names or delete empty rows');

    const validCols = columns.filter(c => c.name.trim());
    const lowerNames = validCols.map(c => c.name.toLowerCase());
    if (new Set(lowerNames).size !== lowerNames.length) return toast('Duplicate column names are not allowed');

    const existingNames = new Set(existingColumns.map(c => c.name.toLowerCase()));
    const conflict = validCols.find(c => existingNames.has(c.name.toLowerCase()));
    if (conflict) return toast(`Column "${conflict.name}" already exists on this page`);

    const finalCols: Column[] = validCols.map((c, i) => ({
      key: `col_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`,
      name: c.name.trim(),
      type: c.type,
      locked: false,
      movable: true,
      copyPerItem: c.type === 'text_with_copy_button',
      multiInput: c.type === 'text_with_copy_button'
    }));

    onSave(finalCols);
    setColumns([{ name: '', type: 'text' }]);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} onBack={onBack} title="➕ Create Column" width="min(500px, 96vw)">
      <div className="text-xs font-bold text-[#607d8b] mb-2">Define columns (add multiple if needed):</div>
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
          <div className="text-[11px] text-[#90a4ae]">No new columns added yet. Add rows to continue.</div>
        ) : (
          columns.map((c, i) => (
            <div key={i} className="text-[11px] p-1 border-b border-gray-100">
              <b>{i + 1}. {c.name || <span className="text-orange-600">(empty name)</span>}</b> <span className="text-[#607d8b]">({c.type})</span>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2 sticky bottom-0 bg-white py-3 border-t border-gray-100 z-10 -mb-1">
        {onBack ? (
          <Button variant="outline" onClick={onBack}>Back to Active Page Settings</Button>
        ) : (
          <Button variant="red" onClick={onClose}>Back to Workspace</Button>
        )}
        <Button variant="green" onClick={handleSave}>Save</Button>
      </div>
    </Modal>
  );
};
