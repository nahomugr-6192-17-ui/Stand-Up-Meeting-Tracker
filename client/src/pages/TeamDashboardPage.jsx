import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { meetingsApi } from '../services/api';
import { formatDDMMYYYY } from '../utils/dateFormatter';
import { ArrowRight, Calendar, AlertCircle } from 'lucide-react';
import Navbar from '../components/Navbar';
import '../styles/Dashboard.css';

export default function TeamDashboardPage() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function loadMeetings() {
      try {
        setLoading(true);
        const data = await meetingsApi.getMeetings();
        setMeetings(data.meetings || []);
      } catch (err) {
        setError(err.message || 'Failed to load stand-up meetings.');
      } finally {
        setLoading(false);
      }
    }
    loadMeetings();
  }, []);

  const handleCardClick = (meetingId) => {
    navigate(`/team/meetings/${meetingId}`);
  };

  return (
    <div className="page-root">
      <Navbar />

      <main className="dashboard-container">
        <div className="dashboard-header">
          <div className="dashboard-title-group">
            <h1>STAND-UP MEETINGS</h1>
            <p>MUQECHA STUDIOS ARCHIVE — READ-ONLY ACCESS</p>
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
            <h3 className="empty-state-title">NO MEETINGS RECORDED YET</h3>
            <p className="empty-state-text">
              There are currently no published stand-up meeting notes available.
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
                </div>

                <div className="meeting-card-actions">
                  <span className="card-nav-arrow">
                    <ArrowRight size={18} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

