import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { meetingsApi } from '../services/api';
import { formatTimeDateEstimate } from '../utils/dateFormatter';
import { Save, Copy, Plus, Trash2, AlertCircle, ArrowLeft } from 'lucide-react';
import Navbar from '../components/Navbar';
import ParticipantModal from '../components/ParticipantModal';
import UnsavedChangesModal from '../components/UnsavedChangesModal';
import '../styles/MeetingView.css';

export default function AdminMeetingEditorPage() {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [toastMessage, setToastMessage] = useState('');

  // Meeting form state
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [nextMeetingDate, setNextMeetingDate] = useState('');
  const [records, setRecords] = useState([]);

  // Unsaved changes tracking
  const [isDirty, setIsDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  // Participant edit modal
  const [activeParticipantIndex, setActiveParticipantIndex] = useState(null);
  const [isParticipantModalOpen, setIsParticipantModalOpen] = useState(false);

  // Load meeting data
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await meetingsApi.getMeetingById(meetingId);
        const m = data.meeting;
        setTitle(m.title || '');

        if (m.meetingDate) {
          const d = new Date(m.meetingDate);
          const yr = d.getFullYear();
          const mo = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          setMeetingDate(`${yr}-${mo}-${day}`);
        }

        if (m.nextMeetingDate) {
          const d = new Date(m.nextMeetingDate);
          const yr = d.getFullYear();
          const mo = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          setNextMeetingDate(`${yr}-${mo}-${day}`);
        } else {
          setNextMeetingDate('');
        }

        setRecords(m.records || []);
        setIsDirty(false);
      } catch (err) {
        setError(err.message || 'Failed to load meeting details.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [meetingId]);

  // Browser beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Do you want to leave without saving?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  // Safe navigation handler
  const attemptNavigation = (targetPath) => {
    if (isDirty) {
      setPendingNavigation(targetPath);
      setShowUnsavedModal(true);
    } else {
      navigate(targetPath);
    }
  };

  const handleConfirmLeave = () => {
    setShowUnsavedModal(false);
    setIsDirty(false);
    if (pendingNavigation) {
      navigate(pendingNavigation);
    } else {
      navigate('/admin');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('LINK COPIED');
    } catch {
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      showToast('LINK COPIED');
    }
  };

  // Participant row operations
  const handleOpenRowModal = (index) => {
    setActiveParticipantIndex(index);
    setIsParticipantModalOpen(true);
  };

  const handleSaveParticipantModal = (updatedParticipant) => {
    setRecords((prev) => {
      const copy = [...prev];
      copy[activeParticipantIndex] = updatedParticipant;
      return copy;
    });
    markDirty();
    // Clear validation error for this row if present
    setValidationErrors((prev) => {
      const copy = { ...prev };
      delete copy[`record_${activeParticipantIndex}`];
      return copy;
    });
  };

  const handleAddRow = () => {
    const newRecord = {
      id: `temp_${Date.now()}`,
      meetingId,
      name: '',
      workSinceLastStandup: '',
      workRating: 5,
      nextStandupWork: '',
      description: '',
      acceptanceCriteria: '',
      questionsFromMembers: '',
      taskAssignment: '',
      timeDateEstimate: '',
      sortOrder: records.length
    };
    setRecords((prev) => [...prev, newRecord]);
    markDirty();
    // Immediately open modal for the new row
    setActiveParticipantIndex(records.length);
    setIsParticipantModalOpen(true);
  };

  const handleDeleteRow = (index, e) => {
    e.stopPropagation();
    const target = records[index];
    const nameStr = target.name?.trim() ? ` "${target.name}"` : ' this participant slot';
    if (window.confirm(`Are you sure you want to remove${nameStr}?`)) {
      setRecords((prev) => prev.filter((_, i) => i !== index));
      markDirty();
    }
  };

  // Main SAVE meeting
  const handleSaveMeeting = async () => {
    setError('');
    const errors = {};

    if (!title.trim()) {
      errors.title = 'Meeting title is required';
    }

    if (!meetingDate) {
      errors.meetingDate = 'Meeting date is required';
    }

    if (!nextMeetingDate) {
      errors.nextMeetingDate = 'Next meeting date is required';
    }

    if (records.length === 0) {
      errors.general = 'Meeting must contain at least one participant record';
    } else {
      records.forEach((rec, idx) => {
        if (!rec.name || !rec.name.trim()) {
          errors[`record_${idx}`] = `Row ${idx + 1}: Name is required`;
        }
      });
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setError('Please resolve all highlighted fields before saving.');
      return;
    }

    setValidationErrors({});

    try {
      setSaving(true);
      await meetingsApi.updateMeeting(meetingId, {
        title: title.trim(),
        meetingDate: new Date(meetingDate).toISOString(),
        nextMeetingDate: new Date(nextMeetingDate).toISOString(),
        records,
        status: 'PUBLISHED'
      });

      setIsDirty(false);
      showToast('MEETING PUBLISHED SUCCESSFULLY');
      setTimeout(() => {
        navigate('/admin');
      }, 700);
    } catch (err) {
      if (err.data && err.data.validationErrors) {
        setValidationErrors(err.data.validationErrors);
      }
      setError(err.message || 'Failed to save meeting.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-root">
        <Navbar />
        <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-secondary)' }}>
          LOADING MEETING EDITOR...
        </div>
      </div>
    );
  }

  return (
    <div className="page-root">
      <Navbar onBackClick={() => attemptNavigation('/admin')} backLabel="ADMIN DASHBOARD" />

      <main className="meeting-page-container">
        {/* Header Bar */}
        <div className="meeting-header-bar">
          <div className="meeting-title-block">
            <input
              type="text"
              className={`editable-title-input ${validationErrors.title ? 'is-invalid' : ''}`}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                markDirty();
              }}
              placeholder="Meeting Title"
              required
            />
            {validationErrors.title && (
              <div className="form-error">{validationErrors.title}</div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
              <span className="meeting-date-badge">MEETING DATE:</span>
              <input
                type="date"
                className={`editable-date-input ${validationErrors.meetingDate ? 'is-invalid' : ''}`}
                value={meetingDate}
                onChange={(e) => {
                  setMeetingDate(e.target.value);
                  markDirty();
                }}
                required
              />
            </div>
            {validationErrors.meetingDate && (
              <div className="form-error">{validationErrors.meetingDate}</div>
            )}
          </div>

          <div className="meeting-header-actions">
            <button
              type="button"
              className="copy-url-btn"
              onClick={handleCopyLink}
              title="Copy meeting URL"
            >
              <Copy size={14} />
              <span>COPY URL</span>
            </button>

            <button
              type="button"
              className="save-meeting-btn"
              onClick={handleSaveMeeting}
              disabled={saving}
            >
              <Save size={15} />
              <span>{saving ? 'SAVING...' : 'SAVE & PUBLISH'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="login-error-alert" style={{ marginBottom: '20px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* 9-Column Editable Table */}
        <div className="table-wrapper">
          <table className="standup-table">
            <thead>
              <tr>
                <th>1. NAME</th>
                <th>2. WORK SINCE LAST STAND-UP</th>
                <th>3. WORK RATING (1–10)</th>
                <th>4. NEXT STAND-UP WORK</th>
                <th>5. DESCRIPTION</th>
                <th>6. ACCEPTANCE CRITERIA</th>
                <th>7. QUESTIONS FROM MEMBERS</th>
                <th>8. TASK ASSIGNMENT</th>
                <th>9. TIME/DATE ESTIMATE</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {records.length > 0 ? (
                records.map((rec, idx) => {
                  const hasRowError = validationErrors[`record_${idx}`];
                  return (
                    <tr
                      key={rec.id || idx}
                      className="clickable-row"
                      style={hasRowError ? { backgroundColor: 'rgba(123, 59, 59, 0.2)' } : {}}
                      onClick={() => handleOpenRowModal(idx)}
                    >
                      <td className="participant-name-cell">
                        {rec.name?.trim() ? (
                          rec.name
                        ) : (
                          <span style={{ color: '#FFA3A3', fontStyle: 'italic' }}>
                            [Required: Click to enter name]
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="text-cell-truncate" title={rec.workSinceLastStandup}>
                          {rec.workSinceLastStandup || '-'}
                        </div>
                      </td>
                      <td>
                        <span className="rating-cell-badge">
                          {rec.workRating || 5} / 10
                        </span>
                      </td>
                      <td>
                        <div className="text-cell-truncate" title={rec.nextStandupWork}>
                          {rec.nextStandupWork || '-'}
                        </div>
                      </td>
                      <td>
                        <div className="text-cell-truncate" title={rec.description}>
                          {rec.description || '-'}
                        </div>
                      </td>
                      <td>
                        <div className="text-cell-truncate" title={rec.acceptanceCriteria}>
                          {rec.acceptanceCriteria || '-'}
                        </div>
                      </td>
                      <td>
                        <div className="text-cell-truncate" title={rec.questionsFromMembers}>
                          {rec.questionsFromMembers || '-'}
                        </div>
                      </td>
                      <td>{rec.taskAssignment || '-'}</td>
                      <td>{formatTimeDateEstimate(rec.timeDateEstimate)}</td>
                      <td className="action-cell" onClick={(e) => e.stopPropagation()}>
                        <div className="action-btn-group">
                          <button
                            type="button"
                            className="btn-open-modal"
                            onClick={() => handleOpenRowModal(idx)}
                            title="Edit participant details"
                          >
                            EDIT
                          </button>
                          <button
                            type="button"
                            className="btn-delete-row"
                            onClick={(e) => handleDeleteRow(idx, e)}
                            title="Delete participant row"
                            aria-label="Delete participant row"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No participant rows. Click "ADD ROW" below to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Bar: ADD ROW + NEXT MEETING PICKER */}
        <div className="table-bottom-bar">
          <button
            type="button"
            className="btn-add-row"
            onClick={handleAddRow}
          >
            <Plus size={16} />
            <span>ADD ROW</span>
          </button>

          <div className="next-meeting-box">
            <span className="next-meeting-label">NEXT MEETING *:</span>
            <input
              type="date"
              className={`next-meeting-input ${validationErrors.nextMeetingDate ? 'is-invalid' : ''}`}
              value={nextMeetingDate}
              onChange={(e) => {
                setNextMeetingDate(e.target.value);
                markDirty();
              }}
              required
            />
          </div>
        </div>
        {validationErrors.nextMeetingDate && (
          <div className="form-error" style={{ textAlign: 'right' }}>
            {validationErrors.nextMeetingDate}
          </div>
        )}

        {/* Participant Editor Modal */}
        {activeParticipantIndex !== null && (
          <ParticipantModal
            isOpen={isParticipantModalOpen}
            onClose={() => setIsParticipantModalOpen(false)}
            participant={records[activeParticipantIndex]}
            isEditable={true}
            onSave={handleSaveParticipantModal}
          />
        )}

        {/* Unsaved Changes Confirmation Modal */}
        <UnsavedChangesModal
          isOpen={showUnsavedModal}
          onCancel={() => setShowUnsavedModal(false)}
          onConfirmLeave={handleConfirmLeave}
        />

        {toastMessage && (
          <div className="toast-banner">
            <span>{toastMessage}</span>
          </div>
        )}
      </main>
    </div>
  );
}

