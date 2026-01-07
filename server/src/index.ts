import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
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

// Environment-aware CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL || 'https://your-app.railway.app']
  : ['http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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

// Serve static frontend files in production (AFTER API routes, BEFORE catch-all)
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../client/dist');

  console.log('===========================================');
  console.log('Production mode - serving static files');
  console.log('__dirname:', __dirname);
  console.log('clientPath:', clientPath);

  // Check if path exists
  try {
    const exists = fs.existsSync(clientPath);
    console.log('clientPath exists:', exists);
    if (exists) {
      const files = fs.readdirSync(clientPath);
      console.log('Files in client/dist:', files);
      // Check assets folder
      const assetsPath = path.join(clientPath, 'assets');
      if (fs.existsSync(assetsPath)) {
        const assetFiles = fs.readdirSync(assetsPath);
        console.log('Files in client/dist/assets:', assetFiles);
      }
    } else {
      console.log('WARNING: client/dist directory does not exist!');
    }
  } catch (err) {
    console.error('Error checking clientPath:', err);
  }
  console.log('===========================================');

  // Serve static assets with fallthrough disabled
  app.use(express.static(clientPath));

  // SPA fallback - serve index.html for any non-API route (MUST be last!)
  app.get('*', (req, res) => {
    console.log('SPA fallback for:', req.url);
    const indexPath = path.join(clientPath, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error sending index.html:', err);
        res.status(500).send('Error loading page');
      }
    });
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
