import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { toNodeHandler } from 'better-auth/node';

import config from './config/env.js';
import { auth } from './auth.js';
import { provisionInitialAccounts } from './scripts/seed.js';
import { seedSampleMeeting } from './utils/seedSampleMeeting.js';
import meetingRoutes from './routes/meetingRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set('trust proxy', 1);

// Configure CORS with credentials for trusted origins
const allowedOrigins = [
  config.CLIENT_URL,
  config.BETTER_AUTH_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cookie']
}));

// CRITICAL: Mount Better Auth handler BEFORE express.json()
app.all('/api/auth/*', toNodeHandler(auth));
app.all('/api/auth', toNodeHandler(auth));

// Body parsing middleware for standard application endpoints
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Muqecha Studios Stand-up API',
    auth: 'Better Auth',
    timestamp: new Date().toISOString()
  });
});

// Protected meeting routes
app.use('/api/meetings', meetingRoutes);

// Serve client static files if built
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
}

// 404 handler for API
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected server error occurred.'
  });
});

export async function startServer() {
  try {
    // Provision initial ADMIN and TEAM accounts
    await provisionInitialAccounts();

    // Seed sample meeting if none exists
    await seedSampleMeeting();

    const server = app.listen(config.PORT, '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(` Muqecha Studios — Stand-up Meeting Management System`);
      console.log(` Authentication: Better Auth (Username Plugin)`);
      console.log(` Server running on port ${config.PORT}`);
      console.log(` Health check: http://localhost:${config.PORT}/api/health`);
      console.log(`=======================================================`);
    });

    return server;
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  startServer();
}

export { app };
export default app;
