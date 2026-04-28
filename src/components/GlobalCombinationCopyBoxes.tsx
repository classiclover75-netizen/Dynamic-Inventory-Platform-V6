import React, { useState, useEffect } from 'react';
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

  // 1. localStorage ki jagah sessionStorage use karein
  const [lastCopiedContent, setLastCopiedContent] = useState<Record<string, string>>(() => {
    try {
      const saved = sessionStorage.getItem('inventory_copy_box_states');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // 2. Save karte waqt bhi sessionStorage use karein
  useEffect(() => {
    sessionStorage.setItem('inventory_copy_box_states', JSON.stringify(lastCopiedContent));
  }, [lastCopiedContent]);

  if (!settings || settings.enabled === false) return null;

  const box3Value = [box1Value, box2Value].filter(Boolean).join(settings.separator);

  const handleCopy = (id: string, text: string, boxName: string) => {
    if (!text) {
      toast(`${boxName} is empty`);
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      toast(`Copied ${boxName} to clipboard`);
      setLastCopiedContent(prev => ({ ...prev, [id]: text }));
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

    // 3. Condition mein empty check add karein taake khali box white rahay
    const isCopied = lastCopiedContent[id] === value && value !== '';
    const isChanged = lastCopiedContent[id] !== undefined && lastCopiedContent[id] !== value && value !== '';
    
    let wrapperClass = "flex-1 min-w-[200px] border rounded-md p-2 flex flex-col gap-1.5 shadow-sm transition-colors duration-200 ";
    
    if (isCopied) {
      wrapperClass += "border-green-500 bg-green-50";
    } else if (isChanged) {
      wrapperClass += "border-red-500 bg-red-50";
    } else {
      wrapperClass += "border-[#d8d8d8] bg-white"; // Refresh par yahi default show hoga
    }

    return (
      <div key={id} className={wrapperClass}>
        <div className={`text-[11px] font-bold uppercase tracking-wide flex justify-between items-center ${isCopied ? 'text-green-700' : isChanged ? 'text-red-700' : 'text-[#607d8b]'}`}>
          <span>{title}</span>
          <button 
            onClick={() => handleCopy(id, value, boxName)}
            className={`bg-transparent border-0 cursor-pointer p-0.5 rounded transition-colors flex items-center gap-1 ${isCopied ? 'text-green-700 hover:bg-green-100' : isChanged ? 'text-red-600 hover:bg-red-100 font-bold animate-pulse' : 'text-[#2b579a] hover:text-[#1a365d] hover:bg-blue-50'}`}
            title="Copy to clipboard"
          >
            <Copy size={12} /> {isCopied ? 'Copied' : isChanged ? 'Copy Update' : 'Copy'}
          </button>
        </div>
        <div className={`text-sm rounded px-2 py-1.5 min-h-[32px] break-all whitespace-pre-wrap ${isCopied ? 'text-green-900 bg-green-100 border border-green-200' : isChanged ? 'text-red-900 bg-red-100 border border-red-200' : 'text-gray-800 bg-gray-50 border border-gray-200'}`}>
          {value || <span className="opacity-50 italic">Empty</span>}
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
