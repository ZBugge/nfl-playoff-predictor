# NFL Playoff Re-Seeding Implementation

## Overview

This document explains how the NFL Playoff Predictor handles playoff re-seeding through a dynamic matchup bonus system.

## The Problem

In NFL playoffs, teams are re-seeded after each round. The lowest remaining seed always plays the #1 seed, which means matchups cannot be predetermined like bracket-style tournaments (e.g., March Madness).

**Example:**
- Wild Card: #2 seed beats #7, #6 upsets #3
- Divisional: #1 seed plays #6 (lowest remaining), NOT #7 as would be expected in chalk

## The Solution: Matchup Bonus System

### Design Philosophy

1. **Single Submission:** Participants predict all games once - no need to return
2. **Chalk Assumptions:** Show expected matchups assuming higher seeds win
3. **Partial Credit:** Award points for correct winner even if matchup changed due to upsets
4. **Bonus for Accuracy:** Extra points for predicting both winner AND matchup correctly

### Scoring Formula

| Scenario | Points Awarded |
|----------|----------------|
| Correct winner + Correct matchup | **1.5×** base points |
| Correct winner + Wrong matchup | **0.75×** base points |
| Wrong winner | **0 points** |

### Database Schema

#### Games Table Additions
```sql
seed_home INTEGER          -- Team seed (e.g., 1-7)
seed_away INTEGER          -- Opponent seed
is_actual_matchup BOOLEAN  -- True if matchup happened as predicted
```

#### Predictions Table Additions
```sql
predicted_opponent TEXT    -- Who user thought team would play
```

### Backend Logic

#### 1. Prediction Submission ([participant.ts](server/src/routes/participant.ts))
When participant submits predictions, we store:
- `predicted_winner`: The team they think will win
- `predicted_opponent`: The team they thought winner would face

```typescript
// User predicts: "Chiefs beat Steelers"
{
  gameId: 5,
  predictedWinner: "KC",
  predictedOpponent: "PIT"
}
```

#### 2. Score Calculation ([leaderboard.ts](server/src/services/leaderboard.ts))

```typescript
function calculatePoints(game: Game, prediction: Prediction) {
  if (game.winner !== prediction.predicted_winner) {
    return 0; // Wrong winner
  }

  // Check if opponent matches
  const matchupMatches =
    game.team_home === prediction.predicted_opponent ||
    game.team_away === prediction.predicted_opponent;

  if (matchupMatches) {
    return basePoints * 1.5; // Matchup bonus!
  } else {
    return basePoints * 0.75; // Partial credit
  }
}
```

### Frontend Implementation

#### 1. Prediction UI ([JoinLobby.tsx](client/src/pages/JoinLobby.tsx))

**Disclaimer for Later Rounds:**
```tsx
{isPostWildcard && (
  <div className="warning-banner">
    ⚠️ These matchups assume higher seeds win (chalk).
    Actual matchups may differ due to upsets.
    Full points (1.5x) for correct matchup,
    partial credit (0.75x) for wrong matchup.
  </div>
)}
```

**Opponent Tracking:**
```typescript
// When user clicks "Chiefs" button
handlePredictionChange(gameId, "KC", "PIT")
// Stores both winner and opponent
```

#### 2. Leaderboard Display ([Leaderboard.tsx](client/src/pages/Leaderboard.tsx))

Shows:
- **Score:** Displays with decimal points (e.g., 7.50)
- **Matchup Bonus:** Green checkmark showing bonus points earned
- **Scoring Explanation:** Clear breakdown of the bonus system

### User Experience Flow

1. **Admin Sets Up Games**
   - Adds Wild Card games (actual matchups known)
   - Adds Divisional/Conference/Super Bowl with **chalk assumptions**
   - Optionally adds seed numbers for clarity

2. **Participant Predicts**
   - Sees all games with chalk matchups
   - Warning banner explains re-seeding possibility
   - Selects winners - system auto-tracks opponents

3. **Games Complete**
   - Admin updates scores (ESPN auto-fetch or manual)
   - System calculates points with matchup multipliers
   - Leaderboard updates with bonus points visible

4. **Leaderboard Shows**
   - Total score (with decimals showing partial/bonus points)
   - Matchup bonus column (how much extra they earned)
   - Full scoring explanation at bottom

## Example Scenarios

### Scenario 1: Chalk Holds
```
User predicts: Chiefs beat Steelers (1v4 matchup)
Actual game:   Chiefs beat Steelers (1v4 matchup)
Points: 1.5 (simple) or 3.0 (weighted divisional)
```

### Scenario 2: Upset Changes Matchup
```
User predicts: Chiefs beat Steelers (1v4 matchup assumed)
Wild Card:     Dolphins upset Steelers
Actual game:   Chiefs beat Dolphins (1v6 matchup)
Points: 0.75 (correct winner, wrong opponent)
```

### Scenario 3: Wrong Winner
```
User predicts: Chiefs beat Steelers
Actual game:   Steelers beat Chiefs
Points: 0.0 (wrong winner)
```

## Technical Benefits

1. **No Database Changes Mid-Season:** Games created upfront with chalk
2. **Single Submission:** Participants don't need to return
3. **Fair Scoring:** Rewards accuracy while forgiving re-seeding
4. **Transparent:** UI clearly explains system to users
5. **Flexible:** Works with any scoring type (simple/weighted/both)

## Future Enhancements

1. **Visual Bracket:** Show bracket tree with re-seeding updates
2. **Prediction Confidence:** Let users mark high-confidence picks
3. **Alternative Matchups:** Show possible matchups based on WC results
4. **Historical Stats:** Track how often chalk holds vs upsets

## Files Modified

### Backend
- `server/src/db/schema.ts` - Added seed and opponent fields
- `server/src/services/lobby.ts` - Updated to track opponents
- `server/src/services/leaderboard.ts` - Matchup bonus calculation
- `server/src/routes/participant.ts` - Accept opponent in submissions

### Frontend
- `client/src/api/api.ts` - Updated TypeScript types
- `client/src/pages/JoinLobby.tsx` - Opponent tracking + disclaimers
- `client/src/pages/Leaderboard.tsx` - Display bonus points

### Documentation
- `README.md` - Added re-seeding explanation
- `RE-SEEDING-IMPLEMENTATION.md` - This file

## Testing Checklist

- [ ] Wild Card predictions (no re-seeding) earn full points
- [ ] Divisional correct winner + correct matchup = 1.5x points
- [ ] Divisional correct winner + wrong matchup = 0.75x points
- [ ] Wrong winner = 0 points in any scenario
- [ ] Weighted scoring applies multipliers correctly
- [ ] "Both" scoring shows both simple and weighted totals
- [ ] Disclaimer shows on Divisional/Conference/Super Bowl rounds
- [ ] Leaderboard displays decimal scores
- [ ] Matchup bonus column shows earned bonuses
