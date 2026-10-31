import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { meetingsApi } from '../services/api';
import { formatDDMMYYYY } from '../utils/dateFormatter';
import { Plus, ArrowRight, Trash2, Calendar, AlertCircle } from 'lucide-react';
import Navbar from '../components/Navbar';
import CreateMeetingModal from '../components/CreateMeetingModal';
import DeleteMeetingModal from '../components/DeleteMeetingModal';
import '../styles/Dashboard.css';

export default function AdminDashboardPage() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const navigate = useNavigate();

  const loadMeetings = async () => {
    try {
      setLoading(true);
      const data = await meetingsApi.getMeetings();
      setMeetings(data.meetings || []);
    } catch (err) {
      setError(err.message || 'Failed to load meetings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleCardClick = (meetingId) => {
    navigate(`/admin/meetings/${meetingId}`);
  };

  const handleCreateMeeting = async ({ title, meetingDate, initialRowCount }) => {
    try {
      setIsCreating(true);
      const res = await meetingsApi.createMeeting({ title, meetingDate, initialRowCount });
      setIsCreateOpen(false);
      navigate(`/admin/meetings/${res.meeting.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create meeting.');
      setIsCreating(false);
    }
  };

  const handleDeleteMeeting = async () => {
    if (!meetingToDelete) return;
    try {
      setIsDeleting(true);
      await meetingsApi.deleteMeeting(meetingToDelete.id);
      setMeetings((prev) => prev.filter((m) => m.id !== meetingToDelete.id));
      showToast('MEETING DELETED SUCCESSFULLY');
      setMeetingToDelete(null);
    } catch (err) {
      setError(err.message || 'Failed to delete meeting.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="page-root">
      <Navbar />

      <main className="dashboard-container">
        <div className="dashboard-header">
          <div className="dashboard-title-group">
            <h1>STAND-UP MANAGEMENT</h1>
            <p>MUQECHA STUDIOS — ADMINISTRATOR CONTROL</p>
          </div>
        </div>

        {error && (
          <div className="login-error-alert" style={{ marginBottom: '24px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
            LOADING MEETINGS...
          </div>
        ) : meetings.length === 0 ? (
          <div className="empty-state">
            <h3 className="empty-state-title">NO MEETINGS CREATED</h3>
            <p className="empty-state-text">
              Click the plus button (+) in the bottom right corner to initialize a stand-up meeting.
            </p>
          </div>
        ) : (
          <div className="meetings-list">
            {meetings.map((meeting) => (
              <div
                key={meeting.id}
                className="meeting-card"
                onClick={() => handleCardClick(meeting.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleCardClick(meeting.id)}
              >
                <div className="meeting-card-content">
                  <span className="meeting-card-date">
                    {formatDDMMYYYY(meeting.meetingDate)}
                  </span>
                  <span className="meeting-card-title">{meeting.title}</span>
                  {meeting.status === 'DRAFT' && (
                    <span className="meeting-card-status-draft">DRAFT</span>
                  )}
                </div>

                <div className="meeting-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="card-delete-btn"
                    title="Delete meeting"
                    aria-label={`Delete meeting ${meeting.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMeetingToDelete(meeting);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>

                  <span
                    className="card-nav-arrow"
                    onClick={() => handleCardClick(meeting.id)}
                  >
                    <ArrowRight size={18} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Floating Add Meeting Button */}
        <button
          type="button"
          className="floating-add-btn"
          onClick={() => setIsCreateOpen(true)}
          title="Create New Meeting"
          aria-label="Create New Meeting"
        >
          <Plus size={24} />
        </button>

        {/* Modals */}
        <CreateMeetingModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onCreate={handleCreateMeeting}
          isCreating={isCreating}
        />

        <DeleteMeetingModal
          isOpen={!!meetingToDelete}
          onClose={() => setMeetingToDelete(null)}
          onConfirm={handleDeleteMeeting}
          meetingTitle={meetingToDelete?.title}
          isDeleting={isDeleting}
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

