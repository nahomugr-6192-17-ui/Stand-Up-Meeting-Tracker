import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

export default function DeleteMeetingModal({
  isOpen,
  onClose,
  onConfirm,
  meetingTitle,
  isDeleting = false
}) {
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onClose();
      }}
    >
      <div className="modal-window" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FFA3A3' }}>
            <AlertTriangle size={18} />
            CONFIRM DELETION
          </h2>
          {!isDeleting && (
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="modal-body" style={{ padding: '24px' }}>
          <p style={{ fontSize: '15px', color: '#FFFFFF', marginBottom: '8px', fontWeight: 500 }}>
            ARE YOU SURE YOU WANT TO DELETE THIS MEETING?
          </p>
          {meetingTitle && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic' }}>
              "{meetingTitle}"
            </p>
          )}
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '12px' }}>
            This action is permanent and will remove the meeting along with all participant records.
          </p>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            CANCEL
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            <Trash2 size={14} />
            {isDeleting ? 'DELETING...' : 'DELETE MEETING'}
          </button>
        </div>
      </div>
    </div>
  );
}

