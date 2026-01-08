# Super Admin Stats Dashboard - Feature Spec

## Overview
A dedicated stats page for super admins to view system-wide analytics including admin accounts, lobbies, participants, and top performers.

## Access
- **Location**: New page at `/admin/stats`
- **Navigation**: "Stats Dashboard" button on the My Lobbies page (visible only to super admins)
- **Authorization**: Super admin only (403 for regular admins)

## Page Design

### Header
- Title: "System Stats"
- Season filter dropdown (required selection, no default)
  - Options: "All Seasons" + list of all seasons
  - Filtering updates all stats on the page

### Layout
Card grid with the following cards:

#### Card 1: Total Admins
- Large number display
- Label: "Admin Accounts"

#### Card 2: Total Lobbies
- Large number display
- Label: "Lobbies Created"

#### Card 3: Total Participants
- Large number display
- Label: "Total Participants"

#### Card 4: Top 3 Largest Lobbies
- Mini leaderboard showing:
  - Rank (1, 2, 3)
  - Lobby name
  - Participant count
- Label: "Largest Lobbies"

#### Card 5: Top 3 Most Active Admins
- Mini leaderboard showing:
  - Rank (1, 2, 3)
  - Admin username
  - Number of lobbies
  - Total participants across their lobbies
- Label: "Most Active Admins"

### Empty State
When filtering by a season with no data:
- Display message: "No activity yet for this season"
- Show in place of stats cards or within each card

## Technical Implementation

### Backend
- Endpoint: `GET /api/admin/stats` (or extend existing `/api/season/limits/stats`)
- Query params: `?seasonId=<id>` (optional, omit for all seasons)
- Response:
```json
{
  "totals": {
    "admins": 15,
    "lobbies": 42,
    "participants": 230
  },
  "topLobbies": [
    { "id": "abc123", "name": "Office Pool", "participantCount": 45 },
    { "id": "def456", "name": "Family Picks", "participantCount": 32 },
    { "id": "ghi789", "name": "Friends League", "participantCount": 28 }
  ],
  "topAdmins": [
    { "id": 1, "username": "john_doe", "lobbyCount": 8, "totalParticipants": 124 },
    { "id": 2, "username": "jane_smith", "lobbyCount": 5, "totalParticipants": 87 },
    { "id": 3, "username": "bob_wilson", "lobbyCount": 4, "totalParticipants": 52 }
  ]
}
```

### Frontend
- New page component: `client/src/pages/StatsPage.tsx`
- Add route: `/admin/stats`
- Add "Stats Dashboard" button to `AdminDashboard.tsx` (super admin only)
- API method: `api.admin.getStats(seasonId?: number)`

### Database Queries
1. **Total admins**: `SELECT COUNT(*) FROM admins`
2. **Total lobbies**: `SELECT COUNT(*) FROM lobbies WHERE season_id = ?` (or no filter)
3. **Total participants**: `SELECT COUNT(*) FROM participants p JOIN lobbies l ON p.lobby_id = l.id WHERE l.season_id = ?`
4. **Top lobbies**:
   ```sql
   SELECT l.id, l.name, COUNT(p.id) as participant_count
   FROM lobbies l
   LEFT JOIN participants p ON l.id = p.lobby_id
   WHERE l.season_id = ? -- optional
   GROUP BY l.id
   ORDER BY participant_count DESC
   LIMIT 3
   ```
5. **Top admins**:
   ```sql
   SELECT a.id, a.username,
          COUNT(DISTINCT l.id) as lobby_count,
          COUNT(p.id) as total_participants
   FROM admins a
   LEFT JOIN lobbies l ON a.id = l.admin_id
   LEFT JOIN participants p ON l.id = p.lobby_id
   WHERE l.season_id = ? -- optional
   GROUP BY a.id
   ORDER BY lobby_count DESC, total_participants DESC
   LIMIT 3
   ```

## Files to Modify/Create
1. `server/src/services/stats.ts` (new) - Stats query functions
2. `server/src/routes/admin.ts` - Add stats endpoint
3. `client/src/api/api.ts` - Add getStats method
4. `client/src/pages/StatsPage.tsx` (new) - Stats page component
5. `client/src/pages/AdminDashboard.tsx` - Add "Stats Dashboard" button
6. `client/src/App.tsx` - Add route

## Verification
1. Log in as super admin
2. Verify "Stats Dashboard" button appears on My Lobbies page
3. Click button, verify navigation to /admin/stats
4. Verify all stat cards display correct data
5. Change season filter, verify stats update accordingly
6. Select season with no data, verify "No activity yet" message
7. Log in as regular admin, verify button is hidden and /admin/stats returns 403
