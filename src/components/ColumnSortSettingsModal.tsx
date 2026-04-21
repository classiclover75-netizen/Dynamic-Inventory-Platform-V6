import React, { useState, useEffect } from 'react';
import { Button, Input, Select, Modal } from './ui';
import { Column } from '../types';

export const ColumnSortSettingsModal = ({
  isOpen,
  onClose,
  column,
  onSave
}: {
  isOpen: boolean;
  onClose: () => void;
  column: Column | null;
  onSave: (updatedColumn: Column) => void;
}) => {
  const [sortEnabled, setSortEnabled] = useState(false);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [sortLocked, setSortLocked] = useState(false);
  const [sortPriority, setSortPriority] = useState<number>(1);

  useEffect(() => {
    if (column && isOpen) {
      setSortEnabled(column.sortEnabled || false);
      setSortDirection(column.sortDirection || "asc");
      setSortLocked(column.sortLocked || false);
      setSortPriority(column.sortPriority || 1);
    }
  }, [column, isOpen]);

  const handleSave = () => {
    if (!column) return;
    onSave({
      ...column,
      sortEnabled,
      sortDirection,
      sortLocked,
      sortPriority
    });
    onClose();
  };

  if (!column) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`⚙️ Sort Settings: ${column.name}`} width="min(300px, 96vw)">
      <div className="mb-3">
        <label className="flex items-center gap-2 text-xs font-bold text-gray-600 mb-1 cursor-pointer">
          <input type="checkbox" checked={sortEnabled} onChange={e => setSortEnabled(e.target.checked)} />
          Enable Sorting
        </label>
      </div>
      {sortEnabled && (
        <>
          <div className="mb-3">
            <label className="block text-xs font-bold text-gray-600 mb-1">Sort Direction</label>
            <Select value={sortDirection} onChange={e => setSortDirection(e.target.value as "asc" | "desc")}>
              <option value="asc">Ascending (A to Z)</option>
              <option value="desc">Descending (Z to A)</option>
            </Select>
          </div>
          <div className="mb-3">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-600 mb-1 cursor-pointer">
              <input type="checkbox" checked={sortLocked} onChange={e => setSortLocked(e.target.checked)} />
              Lock Sorting
            </label>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-bold text-gray-600 mb-1">Sort Priority</label>
            <Input type="number" min={1} value={sortPriority} onChange={e => setSortPriority(parseInt(e.target.value, 10))} />
          </div>
        </>
      )}
      <div className="mt-4 flex justify-end gap-2 sticky bottom-0 bg-white py-3 border-t border-gray-100 z-10 -mb-1">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="green" onClick={handleSave}>Save</Button>
      </div>
    </Modal>
  );
};
