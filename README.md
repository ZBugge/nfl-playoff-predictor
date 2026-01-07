# NFL Playoff Predictor

A full-stack TypeScript application that lets friends compete to predict NFL playoff game winners.

## Features

- **Admin Features:**
  - Create lobbies with customizable scoring systems
  - Add playoff games manually or fetch from ESPN
  - Auto-update scores from ESPN API
  - Manual score override capability
  - Generate shareable invite and leaderboard links

- **Participant Features:**
  - Join lobbies via invite link
  - Submit predictions for all playoff games
  - One-time submission (no login required)

- **Leaderboard:**
  - Live updating scores
  - Multiple scoring options (Simple, Weighted, Both)
  - Real-time progress tracking
  - Champion announcement

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Backend:** Express + TypeScript
- **Database:** SQLite (better-sqlite3)
- **Authentication:** Express Session + bcrypt
- **API Integration:** ESPN API for live scores

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm

**Windows Users:** The server uses `better-sqlite3` which requires native compilation. You need:
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) with "Desktop development with C++" workload

If you don't have build tools installed, you can:
1. Download and install Visual Studio Build Tools from the link above
2. Select "Desktop development with C++" during installation
3. Restart your terminal after installation

### Installation

1. Install root dependencies:
```bash
npm install
```

2. Install server dependencies:
```bash
cd server
npm install
cd ..
```

3. Install client dependencies:
```bash
cd client
npm install
cd ..
```

### Running the Application

#### Development Mode

Run both frontend and backend together:
```bash
npm run dev
```

Or run them separately:

Backend (runs on http://localhost:3001):
```bash
npm run dev:server
```

Frontend (runs on http://localhost:5173):
```bash
npm run dev:client
```

#### Production Mode

1. Build the application:
```bash
npm run build
```

2. Start the server:
```bash
npm start
```

The server will serve the built frontend files.

## Usage Guide

### For Admins

1. **Register/Login:** Visit http://localhost:5173 and register as an admin
2. **Create Lobby:** Click "Create New Lobby" and choose your scoring system
3. **Add Games:** Set up playoff games manually or use ESPN integration
4. **Share Links:** Copy the invite link and send to participants
5. **Update Scores:** Click "Update Scores from ESPN" or manually mark winners
6. **Monitor:** View the leaderboard to track competition

### For Participants

1. **Join:** Click the invite link sent by admin
2. **Predict:** Enter your name and pick winners for all games
3. **Submit:** Click "Submit Predictions" (one-time submission)
4. **Track:** Visit the leaderboard link to see standings

### Scoring Options

The app features an intelligent **Matchup Bonus System** that handles NFL playoff re-seeding:

#### How Re-seeding Works
After the Wild Card round, the NFL re-seeds teams (lowest remaining seed plays #1). Participants make all predictions upfront with assumed "chalk" matchups. The system then awards:

- **Correct winner + Correct matchup:** Full points × 1.5 bonus (e.g., 1.5pts simple scoring)
- **Correct winner + Wrong matchup:** 0.75× points (partial credit for re-seeding)
- **Wrong winner:** 0 points

#### Scoring Types

- **Simple:** Base 1 point per correct pick (with matchup multipliers)
- **Weighted:** Wild Card=1pt, Divisional=2pts, Conference=3pts, Super Bowl=5pts (with matchup multipliers)
- **Both:** Calculate and display both Simple and Weighted scores side-by-side
- **Bracket:** Must predict correct path (like March Madness) - *Note: Not fully implemented*

#### Example
If you predict "Chiefs beat Steelers" in Divisional:
- Actual matchup is "Chiefs beat Bills": You get **0.75 pts** (correct winner, wrong opponent)
- Actual matchup is "Chiefs beat Steelers": You get **1.5 pts** (perfect prediction with bonus)

## Project Structure

```
nfl-playoff-predictor/
├── client/               # React frontend
│   ├── src/
│   │   ├── api/         # API client
│   │   ├── pages/       # Page components
│   │   ├── App.tsx      # Main app component
│   │   └── main.tsx     # Entry point
│   └── package.json
├── server/              # Express backend
│   ├── src/
│   │   ├── auth/        # Authentication logic
│   │   ├── db/          # Database schema
│   │   ├── middleware/  # Express middleware
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic
│   │   └── index.ts     # Server entry point
│   └── package.json
└── package.json         # Root package with dev scripts
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register admin
- `POST /api/auth/login` - Login admin
- `POST /api/auth/logout` - Logout admin
- `GET /api/auth/me` - Get current admin

### Lobby Management
- `POST /api/lobby/create` - Create lobby
- `GET /api/lobby/my-lobbies` - Get admin's lobbies
- `GET /api/lobby/:id` - Get lobby details
- `POST /api/lobby/:id/games` - Add game to lobby
- `GET /api/lobby/:id/games` - Get lobby games

### Participants
- `POST /api/participant/submit` - Submit predictions
- `GET /api/participant/:lobbyId/participants` - Get participants

### Leaderboard
- `GET /api/leaderboard/:lobbyId` - Get leaderboard

### Admin Operations
- `POST /api/admin/game/:gameId/winner` - Update game winner
- `POST /api/admin/lobby/:lobbyId/update-scores` - Update from ESPN
- `GET /api/admin/espn/playoff-games` - Search ESPN playoff games

## Database Schema

- **admins:** Admin accounts with authentication
- **lobbies:** Competition lobbies with settings
- **games:** Playoff games with teams and results
- **participants:** Users who submitted predictions
- **predictions:** Individual game predictions

## Environment Variables

Optional environment variables for production:

- `PORT` - Server port (default: 3001)
- `SESSION_SECRET` - Session encryption key
- `NODE_ENV` - Set to 'production' for production mode

## License

MIT

## Future Enhancements

- Email notifications for game results
- Detailed prediction history view
- Social sharing features
- Bracket-style scoring implementation
- Admin ability to edit/delete games
- Participant profile pages
