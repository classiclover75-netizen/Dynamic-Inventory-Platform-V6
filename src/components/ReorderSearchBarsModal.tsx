import React, { useState, useEffect } from 'react';
import { Button, Modal } from './ui';
import { GripVertical, ArrowLeft } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface ReorderSearchBarsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  order: ('primary' | 'secondary')[];
  activePageName: string;
  secondaryPageName: string;
  onReorder: (newOrder: ('primary' | 'secondary')[]) => void;
}

export const ReorderSearchBarsModal: React.FC<ReorderSearchBarsModalProps> = ({
  isOpen,
  onClose,
  onBack,
  order,
  activePageName,
  secondaryPageName,
  onReorder,
}) => {
  const [localOrder, setLocalOrder] = useState<('primary' | 'secondary')[]>(order);

  useEffect(() => {
    if (isOpen) {
      setLocalOrder(order);
    }
  }, [isOpen, order]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const sourceIdx = result.source.index;
    const destIdx = result.destination.index;
    if (sourceIdx === destIdx) return;

    const newOrder = [...localOrder];
    const [reorderedItem] = newOrder.splice(sourceIdx, 1);
    newOrder.splice(destIdx, 0, reorderedItem);

    setLocalOrder(newOrder);
    onReorder(newOrder);
  };

  const getLabel = (type: 'primary' | 'secondary') => {
    if (type === 'primary') return `Primary Search (${activePageName})`;
    return `Secondary Search (${secondaryPageName || 'None'})`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🔄 Reorder Search Bars" width="min(400px, 96vw)">
      <div className="text-[11px] text-[#78909c] leading-snug mb-4">
        Drag and drop the search bars below to change their display order.
      </div>
      
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="search-bars-droppable">
          {(provided) => (
            <div 
              className="border border-gray-200 rounded bg-white p-1.5"
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {localOrder.map((type, i) => (
                // @ts-ignore
                <Draggable key={type} draggableId={type} index={i}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`flex items-center gap-3 text-[14px] p-3 border-b border-gray-100 hover:bg-gray-50 ${snapshot.isDragging ? 'bg-white shadow-lg rounded ring-1 ring-blue-500 z-50' : ''}`}
                      style={provided.draggableProps.style}
                    >
                      <div {...provided.dragHandleProps} className="text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing">
                        <GripVertical size={16} />
                      </div>
                      <div className="font-bold text-[#2c3e50] flex-1 truncate">
                        {getLabel(type)}
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div className="mt-6 flex justify-between items-center sticky bottom-0 bg-white py-3 border-t border-gray-100 z-10 -mb-1">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-1">
          <ArrowLeft size={16} /> Back
        </Button>
        <Button variant="dark" onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
};
