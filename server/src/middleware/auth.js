import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.js';

export async function requireAuth(req, res, next) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers)
    });

    if (!session || !session.user) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    req.user = session.user;
    req.session = session.session;
    next();
  } catch (err) {
    console.error('[AUTH MIDDLEWARE ERROR]', err);
    return res.status(500).json({ error: 'Internal server error verifying authentication session.' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access forbidden. Administrator privileges required.' });
  }
  next();
}

export function requireTeamOrAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'TEAM' && req.user.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'Access forbidden.' });
  }
  next();
}

export default {
  requireAuth,
  requireAdmin,
  requireTeamOrAdmin
};
