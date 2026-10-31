import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, ArrowLeft, User } from 'lucide-react';
import logoImg from '../assets/muqecha-logo.jpg';
import '../styles/Navbar.css';

export default function Navbar({ onBackClick, backLabel }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleBrandClick = () => {
    if (!user) {
      navigate('/login');
    } else if (user.role === 'ADMIN') {
      navigate('/admin');
    } else {
      navigate('/team');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Determine if back button should be shown
  const isMeetingPage = location.pathname.includes('/meetings/');

  return (
    <header className="navbar-wrapper">
      {/* Left side actions (Back button if on meeting page) */}
      <div className="navbar-left">
        {isMeetingPage && (
          <button
            type="button"
            className="nav-btn"
            onClick={onBackClick || (() => navigate(user?.role === 'ADMIN' ? '/admin' : '/team'))}
            title="Back to dashboard"
          >
            <ArrowLeft size={14} />
            <span>{backLabel || 'DASHBOARD'}</span>
          </button>
        )}
      </div>

      {/* EXACT VIEWPORT CENTER LOGO */}
      <div
        className="navbar-center-brand"
        onClick={handleBrandClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleBrandClick()}
      >
        <img
          src={logoImg}
          alt="Muqecha Studios Logo"
          className="brand-logo-img"
        />
        <div className="brand-text-group">
          <span className="brand-title">Muqecha</span>
          <span className="brand-subtitle">STUDIOS</span>
        </div>
      </div>

      {/* Right side actions */}
      <div className="navbar-right">
        {user ? (
          <>
            <div className="nav-user-badge">
              <span className={`role-pill ${user.role === 'ADMIN' ? 'role-admin' : 'role-team'}`}>
                {user.role}
              </span>
              <span className="nav-username">{user.username}</span>
            </div>
            <button
              type="button"
              className="nav-btn nav-btn-logout"
              onClick={handleLogout}
              title="Log Out"
            >
              <LogOut size={14} />
              <span>LOGOUT</span>
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}

