import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from './ui';
import { AppState, GlobalCopyBoxesSettings } from '../types';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';

interface GlobalCopyBoxesSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  onSave: (settings: GlobalCopyBoxesSettings) => void;
}

export const GlobalCopyBoxesSettingsModal: React.FC<GlobalCopyBoxesSettingsModalProps> = ({
  isOpen,
  onClose,
  state,
  onSave
}) => {
  const [settings, setSettings] = useState<GlobalCopyBoxesSettings>({
    enabled: true,
    box1: { sourcePage: '', sourceColumn: '' },
    box2: { sourcePage: '', sourceColumn: '' },
    separator: '-',
    order: ['box1', 'box2', 'box3']
  });

  useEffect(() => {
    if (isOpen) {
      if (state.globalCopyBoxes) {
        setSettings(state.globalCopyBoxes);
      } else {
        setSettings({
          enabled: true,
          box1: { sourcePage: '', sourceColumn: '' },
          box2: { sourcePage: '', sourceColumn: '' },
          separator: '-',
          order: ['box1', 'box2', 'box3']
        });
      }
    }
  }, [isOpen, state.globalCopyBoxes]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(settings.order);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setSettings({ ...settings, order: items });
  };

  const getColumnsForPage = (pageName: string) => {
    if (!pageName) return [];
    const config = state.pageConfigs[pageName];
    if (!config) return [];
    return config.columns.filter(c => c.type === 'text_with_copy_button');
  };

  const boxLabels: Record<string, string> = {
    box1: settings.box1.label || 'Box 1',
    box2: settings.box2.label || 'Box 2',
    box3: settings.box3Label || 'Box 3 (Combined)'
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📦 Copy Boxes Settings">
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-gray-700">Global Copy Boxes</span>
            <span className="text-xs text-gray-500">Enable or disable the floating copy boxes UI</span>
          </div>
          <button
            onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.enabled ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>

        <div className={`space-y-4 transition-opacity duration-200 ${!settings.enabled ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-gray-700 m-0">Box 1 Configuration</h4>
          <Input
            value={settings.box1.label || ''}
            onChange={(e) => setSettings({ ...settings, box1: { ...settings.box1, label: e.target.value } })}
            placeholder="Custom Label (e.g. Serial Number)"
            className="mb-2"
          />
          <div className="flex gap-2">
            <select
              className="flex-1 p-2 border border-gray-300 rounded text-sm"
              value={settings.box1.sourcePage}
              onChange={(e) => setSettings({ ...settings, box1: { ...settings.box1, sourcePage: e.target.value, sourceColumn: '' } })}
            >
              <option value="">Select Source Page</option>
              {state.pages.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              className="flex-1 p-2 border border-gray-300 rounded text-sm"
              value={settings.box1.sourceColumn}
              onChange={(e) => setSettings({ ...settings, box1: { ...settings.box1, sourceColumn: e.target.value } })}
              disabled={!settings.box1.sourcePage}
            >
              <option value="">Select Source Column</option>
              {getColumnsForPage(settings.box1.sourcePage).map(c => <option key={c.key} value={c.key}>{c.name || c.key}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-bold text-sm text-gray-700 m-0">Box 2 Configuration</h4>
          <Input
            value={settings.box2.label || ''}
            onChange={(e) => setSettings({ ...settings, box2: { ...settings.box2, label: e.target.value } })}
            placeholder="Custom Label (e.g. Model Name)"
            className="mb-2"
          />
          <div className="flex gap-2">
            <select
              className="flex-1 p-2 border border-gray-300 rounded text-sm"
              value={settings.box2.sourcePage}
              onChange={(e) => setSettings({ ...settings, box2: { ...settings.box2, sourcePage: e.target.value, sourceColumn: '' } })}
            >
              <option value="">Select Source Page</option>
              {state.pages.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              className="flex-1 p-2 border border-gray-300 rounded text-sm"
              value={settings.box2.sourceColumn}
              onChange={(e) => setSettings({ ...settings, box2: { ...settings.box2, sourceColumn: e.target.value } })}
              disabled={!settings.box2.sourcePage}
            >
              <option value="">Select Source Column</option>
              {getColumnsForPage(settings.box2.sourcePage).map(c => <option key={c.key} value={c.key}>{c.name || c.key}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-bold text-sm text-gray-700 m-0">Box 3 (Combined) Configuration</h4>
          <div className="flex gap-2">
            <Input
              value={settings.box3Label || ''}
              onChange={(e) => setSettings({ ...settings, box3Label: e.target.value })}
              placeholder="Custom Label (e.g. Full ID)"
              className="flex-1"
            />
            <Input
              value={settings.separator}
              onChange={(e) => setSettings({ ...settings, separator: e.target.value })}
              placeholder="Separator (e.g. -)"
              className="w-32"
            />
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-bold text-sm text-gray-700 m-0">Display Order</h4>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="copy-boxes-order">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                  {settings.order.map((boxId, index) => (
                    // @ts-ignore
                    <Draggable key={boxId} draggableId={boxId} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded"
                        >
                          <div {...provided.dragHandleProps} className="text-gray-400">
                            <GripVertical size={16} />
                          </div>
                          <span className="text-sm font-medium">{boxLabels[boxId]}</span>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2 sticky bottom-0 bg-white py-3 border-t border-gray-100 z-10 -mb-1">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="blue" onClick={() => { onSave(settings); onClose(); }}>Save Settings</Button>
      </div>
    </div>
  </Modal>
  );
};
