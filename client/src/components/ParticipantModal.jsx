import React, { useState, useEffect } from 'react';
import { X, Save, Check } from 'lucide-react';
import { formatTimeDateEstimate } from '../utils/dateFormatter';
import '../styles/ParticipantModal.css';

export default function ParticipantModal({
  isOpen,
  onClose,
  participant,
  isEditable = false,
  onSave
}) {
  const [formData, setFormData] = useState({});
  const [estimateDate, setEstimateDate] = useState('');
  const [estimateTime, setEstimateTime] = useState('');

  useEffect(() => {
    if (participant) {
      setFormData({
        name: participant.name || '',
        workSinceLastStandup: participant.workSinceLastStandup || '',
        workRating: participant.workRating || 5,
        nextStandupWork: participant.nextStandupWork || '',
        description: participant.description || '',
        acceptanceCriteria: participant.acceptanceCriteria || '',
        questionsFromMembers: participant.questionsFromMembers || '',
        taskAssignment: participant.taskAssignment || '',
        timeDateEstimate: participant.timeDateEstimate || ''
      });

      // Parse estimateDate and estimateTime if estimate exists
      if (participant.timeDateEstimate) {
        try {
          const d = new Date(participant.timeDateEstimate);
          if (!isNaN(d.getTime())) {
            const yr = d.getFullYear();
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            setEstimateDate(`${yr}-${mo}-${day}`);

            const hasTime = participant.timeDateEstimate.includes('T') &&
              !participant.timeDateEstimate.endsWith('T00:00:00.000Z') &&
              !participant.timeDateEstimate.endsWith('T00:00');
            if (hasTime) {
              const hr = String(d.getHours()).padStart(2, '0');
              const min = String(d.getMinutes()).padStart(2, '0');
              setEstimateTime(`${hr}:${min}`);
            } else {
              setEstimateTime('');
            }
          } else {
            setEstimateDate('');
            setEstimateTime('');
          }
        } catch {
          setEstimateDate('');
          setEstimateTime('');
        }
      } else {
        setEstimateDate('');
        setEstimateTime('');
      }
    }
  }, [participant, isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !participant) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRatingSelect = (rating) => {
    setFormData((prev) => ({ ...prev, workRating: rating }));
  };

  const handleSaveModal = (e) => {
    e.preventDefault();
    let finalEstimate = '';
    if (estimateDate) {
      if (estimateTime) {
        finalEstimate = `${estimateDate}T${estimateTime}:00`;
      } else {
        finalEstimate = `${estimateDate}T00:00:00.000Z`;
      }
    }

    const updated = {
      ...participant,
      ...formData,
      timeDateEstimate: finalEstimate
    };

    onSave(updated);
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-window large">
        <div className="modal-header">
          <h2 className="modal-title">
            {formData.name?.trim() ? formData.name : 'PARTICIPANT DETAILS'}
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {isEditable ? (
            <form id="participant-edit-form" onSubmit={handleSaveModal} className="modal-edit-form">
              {/* 1. Name */}
              <div className="modal-edit-field">
                <label className="form-label" htmlFor="field-name">
                  1. NAME *
                </label>
                <input
                  id="field-name"
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Participant's full name"
                  required
                />
              </div>

              {/* 2. Work Since Last Stand-up */}
              <div className="modal-edit-field">
                <label className="form-label" htmlFor="field-since">
                  2. WORK SINCE LAST STAND-UP
                </label>
                <textarea
                  id="field-since"
                  rows={3}
                  className="form-textarea"
                  value={formData.workSinceLastStandup}
                  onChange={(e) => handleChange('workSinceLastStandup', e.target.value)}
                  placeholder="Accomplishments and completed tasks"
                />
              </div>

              {/* 3. Work Rating (1–10) */}
              <div className="modal-edit-field">
                <label className="form-label">
                  3. WORK RATING (1–10)
                </label>
                <div className="rating-selector-group">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      className={`rating-chip-btn ${parseInt(formData.workRating, 10) === num ? 'active' : ''}`}
                      onClick={() => handleRatingSelect(num)}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Next Stand-up Work */}
              <div className="modal-edit-field">
                <label className="form-label" htmlFor="field-next">
                  4. NEXT STAND-UP WORK
                </label>
                <textarea
                  id="field-next"
                  rows={3}
                  className="form-textarea"
                  value={formData.nextStandupWork}
                  onChange={(e) => handleChange('nextStandupWork', e.target.value)}
                  placeholder="Planned work for next period"
                />
              </div>

              {/* 5. Description */}
              <div className="modal-edit-field">
                <label className="form-label" htmlFor="field-desc">
                  5. DESCRIPTION
                </label>
                <textarea
                  id="field-desc"
                  rows={3}
                  className="form-textarea"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Technical details, context or notes"
                />
              </div>

              {/* 6. Acceptance Criteria */}
              <div className="modal-edit-field">
                <label className="form-label" htmlFor="field-criteria">
                  6. ACCEPTANCE CRITERIA
                </label>
                <textarea
                  id="field-criteria"
                  rows={2}
                  className="form-textarea"
                  value={formData.acceptanceCriteria}
                  onChange={(e) => handleChange('acceptanceCriteria', e.target.value)}
                  placeholder="Criteria required for completion"
                />
              </div>

              {/* 7. Questions from Members */}
              <div className="modal-edit-field">
                <label className="form-label" htmlFor="field-questions">
                  7. QUESTIONS FROM MEMBERS
                </label>
                <textarea
                  id="field-questions"
                  rows={2}
                  className="form-textarea"
                  value={formData.questionsFromMembers}
                  onChange={(e) => handleChange('questionsFromMembers', e.target.value)}
                  placeholder="Blockers, inquiries, or discussion points"
                />
              </div>

              {/* 8. Task Assignment */}
              <div className="modal-edit-field">
                <label className="form-label" htmlFor="field-assignment">
                  8. TASK ASSIGNMENT
                </label>
                <input
                  id="field-assignment"
                  type="text"
                  className="form-input"
                  value={formData.taskAssignment}
                  onChange={(e) => handleChange('taskAssignment', e.target.value)}
                  placeholder="Associated tickets, projects, or tasks"
                />
              </div>

              {/* 9. Time/Date Estimate */}
              <div className="modal-edit-field">
                <label className="form-label">
                  9. TIME/DATE ESTIMATE
                </label>
                <div className="date-time-inputs">
                  <input
                    type="date"
                    className="form-input"
                    value={estimateDate}
                    onChange={(e) => setEstimateDate(e.target.value)}
                  />
                  <input
                    type="time"
                    className="form-input"
                    value={estimateTime}
                    onChange={(e) => setEstimateTime(e.target.value)}
                    placeholder="Optional time"
                  />
                </div>
              </div>
            </form>
          ) : (
            <div className="participant-details-list">
              <div className="participant-detail-row">
                <span className="participant-detail-label">1. Name</span>
                <span className="participant-detail-value">{formData.name || '-'}</span>
              </div>

              <div className="participant-detail-row">
                <span className="participant-detail-label">2. Work Since Last Stand-up</span>
                <span className="participant-detail-value">{formData.workSinceLastStandup || '-'}</span>
              </div>

              <div className="participant-detail-row">
                <span className="participant-detail-label">3. Work Rating (1–10)</span>
                <div className="participant-detail-value">
                  <span className="rating-badge">{formData.workRating} / 10</span>
                </div>
              </div>

              <div className="participant-detail-row">
                <span className="participant-detail-label">4. Next Stand-up Work</span>
                <span className="participant-detail-value">{formData.nextStandupWork || '-'}</span>
              </div>

              <div className="participant-detail-row">
                <span className="participant-detail-label">5. Description</span>
                <span className="participant-detail-value">{formData.description || '-'}</span>
              </div>

              <div className="participant-detail-row">
                <span className="participant-detail-label">6. Acceptance Criteria</span>
                <span className="participant-detail-value">{formData.acceptanceCriteria || '-'}</span>
              </div>

              <div className="participant-detail-row">
                <span className="participant-detail-label">7. Questions from Members</span>
                <span className="participant-detail-value">{formData.questionsFromMembers || '-'}</span>
              </div>

              <div className="participant-detail-row">
                <span className="participant-detail-label">8. Task Assignment</span>
                <span className="participant-detail-value">{formData.taskAssignment || '-'}</span>
              </div>

              <div className="participant-detail-row">
                <span className="participant-detail-label">9. Time/Date Estimate</span>
                <span className="participant-detail-value">
                  {formatTimeDateEstimate(formData.timeDateEstimate)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {isEditable ? (
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={onClose}
              >
                CANCEL
              </button>
              <button
                type="submit"
                form="participant-edit-form"
                className="btn btn-primary"
              >
                <Check size={14} />
                UPDATE ROW
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
            >
              CLOSE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

