import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function UnsavedChangesModal({
  isOpen,
  onCancel,
  onConfirmLeave
}) {
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="modal-window" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FFD166' }}>
            <AlertTriangle size={18} />
            UNSAVED CHANGES
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onCancel}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '24px' }}>
          <p style={{ fontSize: '15px', color: '#FFFFFF', marginBottom: '8px', fontWeight: 600 }}>
            DO YOU WANT TO LEAVE WITHOUT SAVING?
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
            You have unsaved changes in this meeting record. Leaving now will discard all modified information.
          </p>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onCancel}
          >
            CANCEL (STAY ON PAGE)
          </button>
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={onConfirmLeave}
          >
            LEAVE WITHOUT SAVING
          </button>
        </div>
      </div>
    </div>
  );
}

