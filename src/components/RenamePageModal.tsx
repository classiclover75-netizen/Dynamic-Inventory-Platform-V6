import React, { useState, useEffect } from 'react';
import { Button, Input, Modal } from './ui';
import { useToast } from './ToastProvider';

export const RenamePageModal = ({
  isOpen,
  onClose,
  onBack,
  activePage,
  onRename,
  existingPages
}: {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  activePage: string;
  onRename: (newName: string) => void;
  existingPages: string[];
}) => {
  const [name, setName] = useState(activePage);
  const { toast } = useToast();

  // BUG FIX: Automatically set the input value to the current activePage name whenever the modal opens.
  useEffect(() => {
    if (isOpen) {
      setName(activePage);
    }
  }, [isOpen, activePage]);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return toast('Page name required');
    if (existingPages.includes(trimmedName) && trimmedName !== activePage) return toast('Page name already exists');
    onRename(trimmedName);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} onBack={onBack} title="✏️ Rename Page" width="min(460px, 96vw)">
      <div className="mb-3">
        <label className="block text-xs font-bold text-gray-600 mb-1">New Page Name</label>
        <Input 
          value={name} 
          onChange={e => setName(e.target.value)} 
          placeholder="Enter new page name" 
          autoFocus
        />
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
