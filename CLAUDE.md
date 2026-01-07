# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Root (monorepo orchestration)
```bash
npm run dev           # Run client + server concurrently
npm run dev:server    # Backend only (localhost:3001)
npm run dev:client    # Frontend only (localhost:5173)
npm run build         # Build both client and server
npm start             # Start production server
```

### Server (from server/)
```bash
npm run dev           # tsx watch with live reload
npm run build         # TypeScript compilation
npm test              # Run vitest tests
npm run clear-db      # Reset database
```

### Client (from client/)
```bash
npm run dev           # Vite dev server
npm run build         # TypeScript check + Vite build
npm test              # Run vitest tests
```

## Architecture

**Monorepo** with `client/` (React + Vite) and `server/` (Express + TypeScript).

### Tech Stack
- **Frontend**: React 18, Vite, React Router, TypeScript
- **Backend**: Express, sql.js (SQLite), Express Session, bcryptjs
- **Testing**: Vitest
- **Deployment**: Railway

### Key Directories
- `server/src/routes/` - API endpoints (auth, season, lobby, participant, leaderboard, admin)
- `server/src/services/` - Business logic (season management, scoring, ESPN integration)
- `server/src/db/schema.ts` - Database schema and query utilities
- `client/src/pages/` - Page components
- `client/src/api/api.ts` - API client with fetch wrapper

### Database (sql.js)
Tables: `admins`, `system_config`, `seasons`, `playoff_seeds`, `games`, `lobbies`, `participants`, `predictions`

sql.js API pattern:
```typescript
const stmt = db.prepare("SELECT * FROM table WHERE id = ?");
stmt.bind([id]);
if (stmt.step()) {
  const result = stmt.getAsObject();
}
stmt.free();
// Must call saveDb() after mutations
```

### Authentication
Session-based with `express-session`. Middleware in `server/src/middleware/auth.ts` checks `req.session.adminId`. Credentials require `credentials: 'include'` on frontend fetch calls.

### Re-Seeding System (Core Feature)
NFL re-seeds after each playoff round. The app handles this with:
- `predicted_opponent` stored in predictions table
- `is_actual_matchup` flag in games table
- Matchup bonus scoring: correct winner + correct matchup = 1.5x points

See `RE-SEEDING-IMPLEMENTATION.md` for full details.

### Environment
- **Development**: CORS enabled, API proxy at `/api` → `localhost:3001`
- **Production**: Same-origin (CORS disabled), secure cookies, `NODE_ENV=production`, `SESSION_SECRET` required

### Deployment Notes
See `DEPLOYMENT-LESSONS-LEARNED.md` for Railway deployment details. Critical: Express static file middleware must come BEFORE CORS middleware.
