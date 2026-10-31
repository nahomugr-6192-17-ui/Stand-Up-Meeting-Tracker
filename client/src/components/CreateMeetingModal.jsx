import React, { useState } from 'react';
import { Plus, X, Calendar } from 'lucide-react';

export default function CreateMeetingModal({
  isOpen,
  onClose,
  onCreate,
  isCreating = false
}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(todayStr);
  const [initialRowCount, setInitialRowCount] = useState(3);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Meeting title is required.');
      return;
    }

    if (!meetingDate) {
      setError('Meeting date is required.');
      return;
    }

    onCreate({
      title: title.trim(),
      meetingDate: new Date(meetingDate).toISOString(),
      initialRowCount: parseInt(initialRowCount, 10) || 0
    });
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isCreating) onClose();
      }}
    >
      <div className="modal-window" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} />
            CREATE NEW MEETING
          </h2>
          {!isCreating && (
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

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '24px' }}>
            {error && (
              <div className="login-error-alert" style={{ marginBottom: '16px' }}>
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="create-title">
                MEETING TITLE *
              </label>
              <input
                id="create-title"
                type="text"
                className="form-input"
                placeholder="e.g. Daily Stand-up - Nov 05, 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="create-date">
                MEETING DATE *
              </label>
              <input
                id="create-date"
                type="date"
                className="form-input"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="create-rows">
                NUMBER OF INITIAL PARTICIPANT ROWS
              </label>
              <input
                id="create-rows"
                type="number"
                min="0"
                max="50"
                className="form-input"
                value={initialRowCount}
                onChange={(e) => setInitialRowCount(e.target.value)}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Empty participant slots initially created for this meeting.
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={isCreating}
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isCreating}
            >
              <Plus size={14} />
              {isCreating ? 'CREATING...' : 'CREATE MEETING'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

