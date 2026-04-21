import React, { useState, useEffect } from 'react';
import { Button, Modal } from './ui';
import { GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface ReorderPagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  pages: string[];
  onReorder: (newPages: string[]) => void;
}

export const ReorderPagesModal: React.FC<ReorderPagesModalProps> = ({
  isOpen,
  onClose,
  pages,
  onReorder,
}) => {
  const [localPages, setLocalPages] = useState<string[]>(pages);

  useEffect(() => {
    if (isOpen) {
      setLocalPages(pages);
    }
  }, [isOpen, pages]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const sourceIdx = result.source.index;
    const destIdx = result.destination.index;
    if (sourceIdx === destIdx) return;

    const newPages = [...localPages];
    const [reorderedItem] = newPages.splice(sourceIdx, 1);
    newPages.splice(destIdx, 0, reorderedItem);

    setLocalPages(newPages);
    onReorder(newPages);
  };

  const handleManualReorder = (pageName: string, newPosStr: string) => {
    const newPos = parseInt(newPosStr, 10);
    if (isNaN(newPos)) return;

    const newPages = [...localPages];
    const currentIdx = newPages.indexOf(pageName);
    if (currentIdx === -1) return;

    let targetIdx = newPos - 1;
    if (targetIdx < 0) targetIdx = 0;
    if (targetIdx >= newPages.length) targetIdx = newPages.length - 1;

    if (currentIdx === targetIdx) return;

    const [movedPage] = newPages.splice(currentIdx, 1);
    newPages.splice(targetIdx, 0, movedPage);

    setLocalPages(newPages);
    onReorder(newPages);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🔄 Reorder Pages" width="min(500px, 96vw)">
      <div className="text-[11px] text-[#78909c] leading-snug mb-4">
        Drag and drop the pages below to change their order in the tabs bar. You can also type the position number manually.
      </div>
      
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="pages-droppable">
          {(provided) => (
            <div 
              className="max-h-[400px] overflow-auto border border-gray-200 rounded bg-white p-1.5"
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {localPages.length === 0 ? (
                <div className="text-[11px] text-[#90a4ae] p-4 text-center">No pages to reorder.</div>
              ) : (
                localPages.map((page, i) => (
                  // @ts-ignore
                  <Draggable key={page} draggableId={page} index={i}>
                    {(provided, snapshot) => (
                      <div 
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`flex items-center gap-3 text-[14px] p-2 border-b border-gray-100 hover:bg-gray-50 ${snapshot.isDragging ? 'bg-white shadow-lg rounded ring-1 ring-blue-500 z-50' : ''}`}
                        style={provided.draggableProps.style}
                      >
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            min={1} 
                            max={localPages.length} 
                            value={i + 1}
                            onChange={(e) => handleManualReorder(page, e.target.value)}
                            className="w-12 text-center text-xs border border-gray-300 rounded p-1 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            title="Type position number"
                          />
                          <div {...provided.dragHandleProps} className="text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing">
                            <GripVertical size={16} />
                          </div>
                        </div>
                        <div className="font-bold text-[#2c3e50] flex-1 truncate">
                          {page}
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

      <div className="mt-6 flex justify-end sticky bottom-0 bg-white py-3 border-t border-gray-100 z-10 -mb-1">
        <Button variant="dark" onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
};
