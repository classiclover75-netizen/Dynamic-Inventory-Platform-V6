import React from 'react';
import { Modal, Button } from './ui';

export const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "⚠️ Confirm Deletion",
  message = "Are you sure? This action is permanent and will free up storage space.",
  confirmLabel = "Yes, Delete"
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} width="400px">
      <div className="p-2">
        <p className="text-sm text-gray-700 mb-4">{message}</p>
        <div className="mt-4 flex justify-end gap-2 sticky bottom-0 bg-white py-3 border-t border-gray-100 z-10 -mb-1">
          <Button variant="outline" onClick={onClose}>No, Cancel</Button>
          <Button variant="red" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
};
