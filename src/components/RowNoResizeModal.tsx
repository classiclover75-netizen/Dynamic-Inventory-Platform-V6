import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from './ui';
import { AppState } from '../types';

interface RowNoResizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  onSave: (width: number) => void;
}

export const RowNoResizeModal: React.FC<RowNoResizeModalProps> = ({
  isOpen,
  onClose,
  state,
  onSave
}) => {
  const [width, setWidth] = useState<number>(100);

  useEffect(() => {
    if (isOpen) {
      setWidth(state.globalRowNoWidth || 100);
    }
  }, [isOpen, state.globalRowNoWidth]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📏 Row No. 🔒 Resize Setting">
      <div className="space-y-4">
        <div className="space-y-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-gray-700">Row No. Column Width</span>
            <span className="text-xs text-gray-500">Adjust the width of the first column (sr) globally</span>
          </div>
          <div className="flex items-center gap-4">
            <input 
              type="range" 
              min="50" 
              max="300" 
              value={width} 
              onChange={(e) => setWidth(parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex items-center gap-2">
              <Input 
                type="number"
                min="50"
                max="300"
                value={width}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) setWidth(val);
                }}
                className="w-20 text-center"
              />
              <span className="text-xs font-bold text-gray-500">px</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="blue" onClick={() => { onSave(width); onClose(); }}>Save Setting</Button>
      </div>
    </Modal>
  );
};
