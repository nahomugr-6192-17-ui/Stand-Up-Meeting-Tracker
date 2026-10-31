import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { meetingsApi } from '../services/api';
import { formatDDMMYYYY, formatDDMMYY, formatTimeDateEstimate } from '../utils/dateFormatter';
import { Copy, AlertCircle, Calendar } from 'lucide-react';
import Navbar from '../components/Navbar';
import ParticipantModal from '../components/ParticipantModal';
import '../styles/MeetingView.css';

export default function TeamMeetingDetailsPage() {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Selected participant for modal
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    async function loadMeeting() {
      try {
        setLoading(true);
        const data = await meetingsApi.getMeetingById(meetingId);
        setMeeting(data.meeting);
      } catch (err) {
        setError(err.message || 'Meeting not found or you lack permission to view it.');
      } finally {
        setLoading(false);
      }
    }
    loadMeeting();
  }, [meetingId]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToastMessage('LINK COPIED');
      setTimeout(() => setToastMessage(''), 2500);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setToastMessage('LINK COPIED');
      setTimeout(() => setToastMessage(''), 2500);
    }
  };

  const handleOpenParticipant = (participant) => {
    setSelectedParticipant(participant);
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="page-root">
        <Navbar />
        <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-secondary)' }}>
          LOADING MEETING DETAILS...
        </div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="page-root">
        <Navbar />
        <div className="meeting-page-container">
          <div className="login-error-alert" style={{ margin: '40px 0' }}>
            <AlertCircle size={18} />
            <span>{error || 'Meeting not found.'}</span>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('/team')}
          >
            RETURN TO DASHBOARD
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-root">
      <Navbar onBackClick={() => navigate('/team')} backLabel="MEETINGS" />

      <main className="meeting-page-container">
        {/* Header Bar */}
        <div className="meeting-header-bar">
          <div className="meeting-title-block">
            <h1 className="meeting-title-text">{meeting.title}</h1>
            <div className="meeting-date-badge">
              DATE: {formatDDMMYYYY(meeting.meetingDate)}
            </div>
          </div>

          <div className="meeting-header-actions">
            <button
              type="button"
              className="copy-url-btn"
              onClick={handleCopyLink}
              title="Copy meeting URL to clipboard"
            >
              <Copy size={14} />
              <span>COPY LINK</span>
            </button>
          </div>
        </div>

        {/* 9-Column Meeting Table */}
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
                <th style={{ textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {meeting.records && meeting.records.length > 0 ? (
                meeting.records.map((rec) => (
                  <tr
                    key={rec.id}
                    className="clickable-row"
                    onClick={() => handleOpenParticipant(rec)}
                  >
                    <td className="participant-name-cell">{rec.name || '-'}</td>
                    <td>
                      <div className="text-cell-truncate" title={rec.workSinceLastStandup}>
                        {rec.workSinceLastStandup || '-'}
                      </div>
                    </td>
                    <td>
                      <span className="rating-cell-badge">
                        {rec.workRating} / 10
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
                      <button
                        type="button"
                        className="btn-open-modal"
                        onClick={() => handleOpenParticipant(rec)}
                      >
                        OPEN
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No participant records in this meeting note.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom bar with Next Meeting indicator */}
        <div className="table-bottom-bar">
          <div className="next-meeting-box">
            <span className="next-meeting-label">NEXT MEETING:</span>
            <span className="next-meeting-val">
              {meeting.nextMeetingDate
                ? formatDDMMYY(meeting.nextMeetingDate)
                : 'TO BE SCHEDULED'}
            </span>
          </div>
        </div>

        {/* Read-only Participant Details Modal */}
        <ParticipantModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          participant={selectedParticipant}
          isEditable={false}
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

