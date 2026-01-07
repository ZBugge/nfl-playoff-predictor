import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './db/schema.js';
import authRoutes from './routes/auth.js';
import lobbyRoutes from './routes/lobby.js';
import participantRoutes from './routes/participant.js';
import leaderboardRoutes from './routes/leaderboard.js';
import adminRoutes from './routes/admin.js';
import seasonRoutes from './routes/season.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const SESSION_SECRET = process.env.SESSION_SECRET || 'nfl-playoff-predictor-secret-key-change-in-production';

// Validate environment variables in production
if (process.env.NODE_ENV === 'production' && SESSION_SECRET.includes('change-in-production')) {
  console.error('ERROR: SESSION_SECRET must be set in production!');
  process.exit(1);
}

initializeDatabase();

// Serve static files FIRST (before CORS) in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../client/dist');
  console.log('Setting up static file serving from:', clientPath);
  app.use(express.static(clientPath));
}

// Environment-aware CORS configuration (only needed for development when frontend is on different port)
if (process.env.NODE_ENV !== 'production') {
  const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174'];
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }));
}

app.use(express.json());

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/lobby', lobbyRoutes);
app.use('/api/participant', participantRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/season', seasonRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// SPA fallback - serve index.html for any non-API route (MUST be last!)
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../client/dist');
  app.get('*', (_req, res) => {
    const indexPath = path.join(clientPath, 'index.html');
    res.sendFile(indexPath);
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
