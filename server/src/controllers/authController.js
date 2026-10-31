const bcrypt = require('bcryptjs');
const db = require('../services/db');

// Simple in-memory rate limiting map for login attempts
const loginAttempts = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, firstAttempt: now };
  
  // Reset window after 15 minutes
  if (now - record.firstAttempt > 15 * 60 * 1000) {
    record.count = 0;
    record.firstAttempt = now;
  }

  if (record.count >= 10) {
    return false;
  }

  record.count++;
  loginAttempts.set(ip, record);
  return true;
}

function clearRateLimit(ip) {
  loginAttempts.delete(ip);
}

const authController = {
  login: async (req, res) => {
    try {
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ error: 'Too many failed login attempts. Please try again in 15 minutes.' });
      }

      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }

      const user = await db.users.findByUsername(username.trim());
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash || '');
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      clearRateLimit(clientIp);

      // Create session
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];
      const session = await db.sessions.create({
        userId: user.id,
        ipAddress,
        userAgent,
        daysValid: 7
      });

      // Set secure HTTP-only cookie
      res.cookie('muqecha_session', session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });

      return res.status(200).json({
        message: 'Login successful',
        token: session.token,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role
        }
      });
    } catch (err) {
      console.error('[LOGIN ERROR]', err);
      return res.status(500).json({ error: 'Internal server error during authentication.' });
    }
  },

  logout: async (req, res) => {
    try {
      const token = req.cookies?.muqecha_session;
      if (token) {
        await db.sessions.deleteByToken(token);
      }
      res.clearCookie('muqecha_session', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
      });
      return res.status(200).json({ message: 'Logged out successfully' });
    } catch (err) {
      console.error('[LOGOUT ERROR]', err);
      return res.status(500).json({ error: 'Failed to log out.' });
    }
  },

  me: async (req, res) => {
    try {
      // req.user is set by requireAuth middleware
      return res.status(200).json({
        user: {
          id: req.user.id,
          name: req.user.name,
          username: req.user.username,
          role: req.user.role
        }
      });
    } catch (err) {
      console.error('[ME ERROR]', err);
      return res.status(500).json({ error: 'Failed to retrieve session info.' });
    }
  }
};

module.exports = authController;

