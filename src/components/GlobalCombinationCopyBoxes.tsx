import React from 'react';
import { AppState, GlobalCopyBoxesSettings } from '../types';
import { Copy } from 'lucide-react';
import { useToast } from './ToastProvider';

interface GlobalCombinationCopyBoxesProps {
  settings?: GlobalCopyBoxesSettings;
  box1Value: string;
  box2Value: string;
}

export const GlobalCombinationCopyBoxes: React.FC<GlobalCombinationCopyBoxesProps> = ({
  settings,
  box1Value,
  box2Value
}) => {
  const { toast } = useToast();

  if (!settings || settings.enabled === false) return null;

  const box3Value = [box1Value, box2Value].filter(Boolean).join(settings.separator);

  const handleCopy = (text: string, boxName: string) => {
    if (!text) {
      toast(`${boxName} is empty`);
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      toast(`Copied ${boxName} to clipboard`);
    }).catch(() => {
      toast(`Failed to copy ${boxName}`);
    });
  };

  const renderBox = (id: string) => {
    let title = '';
    let value = '';
    let boxName = '';

    if (id === 'box1') {
      title = settings.box1.label || 'Box 1';
      value = box1Value;
      boxName = settings.box1.label || 'Box 1';
    } else if (id === 'box2') {
      title = settings.box2.label || 'Box 2';
      value = box2Value;
      boxName = settings.box2.label || 'Box 2';
    } else if (id === 'box3') {
      title = settings.box3Label || 'Box 3 (Combined)';
      value = box3Value;
      boxName = settings.box3Label || 'Combined Box';
    }

    return (
      <div key={id} className="flex-1 min-w-[200px] bg-white border border-[#d8d8d8] rounded-md p-2 flex flex-col gap-1.5 shadow-sm">
        <div className="text-[11px] font-bold text-[#607d8b] uppercase tracking-wide flex justify-between items-center">
          <span>{title}</span>
          <button 
            onClick={() => handleCopy(value, boxName)}
            className="text-[#2b579a] hover:text-[#1a365d] bg-transparent border-0 cursor-pointer p-0.5 rounded hover:bg-blue-50 transition-colors flex items-center gap-1"
            title="Copy to clipboard"
          >
            <Copy size={12} /> Copy
          </button>
        </div>
        <div className="text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 min-h-[32px] break-all whitespace-pre-wrap">
          {value || <span className="text-gray-400 italic">Empty</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="flex gap-2 flex-wrap mb-2">
      {settings.order.map(renderBox)}
    </div>
  );
};
