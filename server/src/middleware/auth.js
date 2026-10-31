const db = require('../services/db');

async function requireAuth(req, res, next) {
  try {
    let token = req.cookies?.muqecha_session;

    // Also support Authorization header
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    const sessionData = await db.sessions.findByToken(token);
    if (!sessionData) {
      res.clearCookie('muqecha_session', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
      });
      return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    }

    req.user = sessionData.user;
    req.session = sessionData;
    next();
  } catch (err) {
    console.error('[AUTH MIDDLEWARE ERROR]', err);
    return res.status(500).json({ error: 'Internal server error verifying session' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access forbidden. Administrator privileges required.' });
  }
  next();
}

function requireTeamOrAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'TEAM' && req.user.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'Access forbidden.' });
  }
  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireTeamOrAdmin
};

