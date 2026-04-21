import React, { useState } from 'react';
import { CopyBoxConfig } from '../types';
import { Button, Input, Modal, SelectableDropdown } from './ui';
import { Trash2, Plus, ArrowUp, ArrowDown } from 'lucide-react';

interface CopySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  copyBoxes: CopyBoxConfig[];
  combinedBoxEnabled: boolean;
  onSave: (copyBoxes: CopyBoxConfig[], combinedBoxEnabled: boolean) => void;
  pages: string[];
  pageConfigs: Record<string, any>;
}

export const CopySettingsModal: React.FC<CopySettingsModalProps> = ({
  isOpen,
  onClose,
  copyBoxes,
  combinedBoxEnabled,
  onSave,
  pages,
  pageConfigs,
}) => {
  const [localBoxes, setLocalBoxes] = useState<CopyBoxConfig[]>(copyBoxes || []);
  const [localCombinedEnabled, setLocalCombinedEnabled] = useState(combinedBoxEnabled || false);

  React.useEffect(() => {
    if (isOpen) {
      setLocalBoxes(copyBoxes || []);
      setLocalCombinedEnabled(combinedBoxEnabled || false);
    }
  }, [isOpen, copyBoxes, combinedBoxEnabled]);

  const handleAddBox = () => {
    const newBox: CopyBoxConfig = {
      id: Math.random().toString(36).substring(2, 9),
      label: `Box ${localBoxes.length + 1}`,
      sourcePage: pages[0] || '',
      sourceColumn: '',
      lookupColumn: '',
      enabled: true,
      currentValue: '',
      currentLookupValue: '',
    };
    setLocalBoxes([...localBoxes, newBox]);
  };

  const handleUpdateBox = (index: number, updates: Partial<CopyBoxConfig>) => {
    const newBoxes = [...localBoxes];
    newBoxes[index] = { ...newBoxes[index], ...updates };
    setLocalBoxes(newBoxes);
  };

  const handleDeleteBox = (index: number) => {
    const newBoxes = [...localBoxes];
    newBoxes.splice(index, 1);
    setLocalBoxes(newBoxes);
  };

  const handleMoveBox = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newBoxes = [...localBoxes];
      [newBoxes[index - 1], newBoxes[index]] = [newBoxes[index], newBoxes[index - 1]];
      setLocalBoxes(newBoxes);
    } else if (direction === 'down' && index < localBoxes.length - 1) {
      const newBoxes = [...localBoxes];
      [newBoxes[index + 1], newBoxes[index]] = [newBoxes[index], newBoxes[index + 1]];
      setLocalBoxes(newBoxes);
    }
  };

  const handleSave = () => {
    onSave(localBoxes, localCombinedEnabled);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📋 Copy Settings">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={localCombinedEnabled}
              onChange={(e) => setLocalCombinedEnabled(e.target.checked)}
              className="rounded border-gray-300"
            />
            Enable Combined Copy Box
          </label>
          <Button onClick={handleAddBox} size="sm" variant="outline" className="flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add Box
          </Button>
        </div>

        <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
          {/* ... (localBoxes.map remains the same) */}
          {localBoxes.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No copy boxes configured.</p>
          ) : (
            localBoxes.map((box, index) => {
              const pageColumns = pageConfigs[box.sourcePage]?.columns || [];
              const filteredColumns = pageColumns.filter((c: any) => c.type === 'text_with_copy_button');
              
              return (
                <div key={box.id} className="flex items-start gap-2 p-3 border rounded-md bg-gray-50">
                  <div className="flex flex-col gap-1 mt-1">
                    <button
                      onClick={() => handleMoveBox(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveBox(index, 'down')}
                      disabled={index === localBoxes.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500">Label</label>
                      <Input
                        value={box.label}
                        onChange={(e) => handleUpdateBox(index, { label: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="Box Label"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500">Source Page</label>
                      <SelectableDropdown
                        value={box.sourcePage}
                        onChange={(val) => {
                          const newPage = val;
                          const newColumns = pageConfigs[newPage]?.columns || [];
                          const newFilteredColumns = newColumns.filter((c: any) => c.type === 'text_with_copy_button');
                          handleUpdateBox(index, { 
                            sourcePage: newPage,
                            sourceColumn: newFilteredColumns.length > 0 ? newFilteredColumns[0].key : '',
                            lookupColumn: ''
                          });
                        }}
                        options={pages.map(p => ({ value: p, label: p }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500">Source Column</label>
                      <SelectableDropdown
                        value={box.sourceColumn}
                        onChange={(val) => handleUpdateBox(index, { sourceColumn: val })}
                        options={filteredColumns.map((c: any) => ({ value: c.key, label: c.name }))}
                        className="h-8 text-sm"
                        disabled={!box.sourcePage || filteredColumns.length === 0}
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <label className="text-xs text-gray-500">Secondary Lookup Column</label>
                      <SelectableDropdown
                        value={box.lookupColumn || ''}
                        onChange={(val) => handleUpdateBox(index, { lookupColumn: val })}
                        options={pageColumns.map((c: any) => ({ value: c.key, label: c.name }))}
                        className="h-8 text-sm"
                        disabled={!box.sourcePage}
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-between mt-1">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={box.enabled}
                          onChange={(e) => handleUpdateBox(index, { enabled: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        Enabled
                      </label>
                      <Button
                        onClick={() => handleDeleteBox(index)}
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2 sticky bottom-0 bg-white py-3 border-t border-gray-100 z-10 -mb-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-[#2b579a] hover:bg-[#1e3e6e] text-white">
            Save Settings
          </Button>
        </div>
      </div>
    </Modal>
  );
};
