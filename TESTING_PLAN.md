# Manual Testing Plan - Playoff Re-seeding

## Prerequisites
1. Start the application (both server and client running)
2. Log in as an admin
3. Create a new season with playoff seeding

## Test Suite 1: Basic Re-seeding Flow (Happy Path)

### Setup
1. Navigate to Season Management
2. Enter all 14 playoff seeds (7 AFC, 7 NFC):
   - **AFC**: Chiefs (1), Bills (2), Ravens (3), Texans (4), Browns (5), Dolphins (6), Steelers (7)
   - **NFC**: 49ers (1), Cowboys (2), Lions (3), Buccaneers (4), Packers (5), Rams (6), Eagles (7)
3. Click "Generate Playoff Games"
4. Verify 13 games are created (6 Wild Card, 4 Divisional, 2 Conference, 1 Super Bowl)

### Test 1.1: Wild Card Completion Shows Divisional Matchups
**Steps:**
1. Verify Divisional games show "TBD vs TBD"
2. Complete all 6 Wild Card games (simulate chalk - higher seeds win):
   - Game 1: Bills beat Steelers
   - Game 2: Ravens beat Dolphins
   - Game 3: Texans beat Browns
   - Game 4: Cowboys beat Eagles
   - Game 5: Lions beat Rams
   - Game 6: Buccaneers beat Packers
3. Refresh the page or check Divisional Round section

**Expected Result:**
- **AFC Divisional Game 1**: Chiefs vs Texans (1 vs 4)
- **AFC Divisional Game 2**: Bills vs Ravens (2 vs 3)
- **NFC Divisional Game 1**: 49ers vs Buccaneers (1 vs 4)
- **NFC Divisional Game 2**: Cowboys vs Lions (2 vs 3)
- All games should show "is_actual_matchup" as true (not TBD)
- Conference and Super Bowl games should still be TBD

### Test 1.2: Divisional Completion Shows Conference Matchups
**Steps:**
1. Complete all 4 Divisional games (higher seeds win):
   - AFC Div 1: Chiefs beat Texans
   - AFC Div 2: Bills beat Ravens
   - NFC Div 1: 49ers beat Buccaneers
   - NFC Div 2: Cowboys beat Lions
2. Check Conference Championship section

**Expected Result:**
- **AFC Conference**: Chiefs vs Bills (1 vs 2)
- **NFC Conference**: 49ers vs Cowboys (1 vs 2)
- Super Bowl should still be TBD

### Test 1.3: Conference Completion Shows Super Bowl Matchup
**Steps:**
1. Complete both Conference Championships:
   - AFC Conference: Chiefs beat Bills
   - NFC Conference: 49ers beat Cowboys
2. Check Super Bowl section

**Expected Result:**
- **Super Bowl**: Chiefs vs 49ers
- Game should be marked as actual matchup

---

## Test Suite 2: Re-seeding with Upsets

### Setup
Start fresh season with same seeds as Test Suite 1

### Test 2.1: Wild Card Upsets Change Divisional Matchups
**Steps:**
1. Complete Wild Card with upsets (lower seeds win):
   - Game 1: **Steelers** beat Bills (7 beats 2)
   - Game 2: **Dolphins** beat Ravens (6 beats 3)
   - Game 3: **Browns** beat Texans (5 beats 4)
   - Game 4: Cowboys beat Eagles (chalk)
   - Game 5: Lions beat Rams (chalk)
   - Game 6: Buccaneers beat Packers (chalk)
2. Check Divisional Round

**Expected Result:**
- **AFC Divisional Game 1**: Chiefs vs Steelers (1 vs 7) - worst remaining seed
- **AFC Divisional Game 2**: Browns vs Dolphins (5 vs 6) - best plays second-best
- **NFC Divisional**: Should be same as Test 1.1 (no upsets)

### Test 2.2: Divisional Upsets Change Conference Matchups
**Steps:**
1. From Test 2.1 state, complete Divisional with upsets:
   - AFC Div 1: **Steelers** beat Chiefs (7 beats 1)
   - AFC Div 2: **Dolphins** beat Browns (6 beats 5)
   - NFC Div 1: 49ers beat Buccaneers (chalk)
   - NFC Div 2: Cowboys beat Lions (chalk)
2. Check Conference Championships

**Expected Result:**
- **AFC Conference**: Dolphins vs Steelers (6 vs 7) - better seed is home
- **NFC Conference**: 49ers vs Cowboys (chalk)

---

## Test Suite 3: Changing Winners (Cascade Clear)

### Setup
Complete a full bracket through Super Bowl (use Test 1 results)

### Test 3.1: Changing Wild Card Winner Clears Divisional
**Steps:**
1. Navigate to Wild Card Game 3 (originally: Texans beat Browns)
2. Note the current Divisional matchup: Chiefs vs Texans
3. Note that Chiefs beat Texans in Divisional Round (winner is set)
4. Change Wild Card Game 3 winner: Click "Browns Wins"
5. Check Divisional Round

**Expected Result:**
- **AFC Divisional Game 1** should now be: Chiefs vs Browns (matchup changed)
- **AFC Divisional Game 1** should have NO winner (cleared)
- Game should be marked as incomplete (completed = 0)
- Verify the winner badge is removed

### Test 3.2: Changing Divisional Winner Clears Conference and Super Bowl
**Steps:**
1. From a completed bracket (Chiefs won Super Bowl)
2. Note Conference Championship: Chiefs beat Bills
3. Note Super Bowl: Chiefs beat 49ers (winner set)
4. Go to AFC Divisional Game 2 (Bills beat Ravens originally)
5. Change winner: Click "Ravens Wins"
6. Check Conference Championship and Super Bowl

**Expected Result:**
- **AFC Conference** matchup should change to: Chiefs vs Ravens
- **AFC Conference** should have NO winner (cleared)
- **Super Bowl** should have NO winner (cleared)
- All downstream games affected by the change should be incomplete

### Test 3.3: Changing Conference Winner Clears Super Bowl
**Steps:**
1. From a completed bracket
2. Note Super Bowl winner is set
3. Go to NFC Conference Championship (49ers beat Cowboys originally)
4. Change winner: Click "Cowboys Wins"
5. Check Super Bowl

**Expected Result:**
- **Super Bowl** matchup changes to: Chiefs vs Cowboys
- **Super Bowl** should have NO winner (cleared)
- Game marked as incomplete

### Test 3.4: Re-setting Same Winner Does NOT Clear Downstream
**Steps:**
1. Complete Wild Card → Divisional (Bills beat Steelers, then Chiefs beat Texans)
2. Note Divisional winner is set (Chiefs beat Texans)
3. Go back to Wild Card Game 1
4. Click "Bills Wins" again (same winner)
5. Check Divisional Round

**Expected Result:**
- Divisional matchup should remain: Chiefs vs Texans
- Divisional winner should still be set: Chiefs (NOT cleared)
- Winner should be preserved because matchup didn't change

---

## Test Suite 4: Partial Round Completion

### Test 4.1: Incomplete Wild Card Doesn't Update Divisional
**Steps:**
1. Start fresh season
2. Complete only 5 out of 6 Wild Card games
3. Leave one game incomplete
4. Check Divisional Round

**Expected Result:**
- All Divisional games should still show "TBD vs TBD"
- No matchups should be set (is_actual_matchup = 0)

### Test 4.2: Incomplete Divisional Doesn't Update Conference
**Steps:**
1. Complete all 6 Wild Card games
2. Complete only 3 out of 4 Divisional games
3. Check Conference Championships

**Expected Result:**
- Both Conference games should still show "TBD vs TBD"
- No matchups should be set

### Test 4.3: Single Conference Championship Doesn't Update Super Bowl
**Steps:**
1. Complete through Divisional Round
2. Complete only AFC Conference Championship
3. Leave NFC Conference Championship incomplete
4. Check Super Bowl

**Expected Result:**
- Super Bowl should still show "TBD vs TBD"
- No matchup should be set

---

## Test Suite 5: UI/UX Verification

### Test 5.1: Verify Team Name Formatting
**Steps:**
1. Go to Season Management
2. Type team names in various formats:
   - "Chiefs" (proper case)
   - "LA Chargers" (space included)
   - "49ers" (number included)
   - "chiefs" (lowercase)

**Expected Result:**
- Input should accept ANY case (no forced uppercase)
- Team names should be stored exactly as typed
- Names should display correctly in game cards

### Test 5.2: Edit Winner on Completed Games
**Steps:**
1. Complete any game (e.g., Bills beat Steelers)
2. Verify winner badge appears: "Winner: Bills"
3. Verify both team buttons are still visible:
   - "Bills Wins"
   - "Steelers Wins"
4. Click "Steelers Wins"

**Expected Result:**
- Winner should change immediately
- Badge should update to "Winner: Steelers"
- Buttons should remain visible for future edits

### Test 5.3: Visual Indication of Winner
**Steps:**
1. Complete a game
2. Check the game card

**Expected Result:**
- Winning team should have visual styling (winner class applied)
- Winner badge should be green/success color
- Both team buttons remain enabled

---

## Test Suite 6: Multi-Lobby Isolation

### Test 6.1: Changes Don't Affect Other Lobbies
**Steps:**
1. Create 2 lobbies for the same season
2. Add participants to both lobbies
3. In Lobby 1: Complete Wild Card → Check Divisional matchups
4. In Lobby 2: Navigate to brackets page

**Expected Result:**
- Both lobbies should show the same actual matchups (single source of truth)
- Participants in both lobbies see updated brackets
- Re-seeding applies globally to the season, not per-lobby

---

## Test Suite 7: Edge Cases

### Test 7.1: Rapid Winner Changes
**Steps:**
1. Complete a Wild Card game
2. Immediately change the winner back and forth 3-4 times rapidly
3. Check Divisional Round

**Expected Result:**
- System handles rapid changes gracefully
- Final matchup reflects the last winner selected
- No race conditions or stale data

### Test 7.2: Seed Information Preservation
**Steps:**
1. Complete all rounds through Super Bowl
2. Check every game in Season Management

**Expected Result:**
- All games with actual matchups should display seed numbers
- Higher seed (lower number) should always be the home team
- Seed metadata visible in UI or database

### Test 7.3: Delete and Regenerate Games
**Steps:**
1. Complete half the bracket
2. Click "Reset All Games"
3. Re-generate games with different seeds
4. Complete new bracket

**Expected Result:**
- Old game data completely cleared
- New bracket generates correctly with new seeds
- Re-seeding works properly with new data

---

## Test Suite 8: Leaderboard Integration

### Test 8.1: Predictions with Changing Matchups
**Steps:**
1. Create a lobby with 2 participants
2. Have each participant make predictions (some with opponent predictions)
3. Complete Wild Card to trigger re-seeding
4. Check leaderboard

**Expected Result:**
- Participants with correct Wild Card predictions get points
- Predictions for TBD games (Divisional) should not yet count
- Once Divisional matchups are set, predictions against new matchups should score correctly

### Test 8.2: Scoring After Winner Change
**Steps:**
1. Complete a bracket with participant predictions
2. Check leaderboard (note scores)
3. Change a Wild Card winner (affecting Divisional matchup)
4. Re-check leaderboard

**Expected Result:**
- Scores should update to reflect new reality
- Games with cleared winners don't count for/against predictions
- Leaderboard rankings may change based on new matchups

---

## Critical Path Test (Full E2E)

**Complete this test to verify the entire feature works end-to-end:**

1. ✅ Create season with all 14 seeds
2. ✅ Generate playoff games (13 total)
3. ✅ Verify all games created with correct initial state
4. ✅ Complete all Wild Card games → Check Divisional matchups appear
5. ✅ Complete all Divisional games → Check Conference matchups appear
6. ✅ Complete both Conference games → Check Super Bowl matchup appears
7. ✅ Complete Super Bowl → Verify winner
8. ✅ Change a Divisional game winner → Verify Conference and Super Bowl cleared
9. ✅ Complete new Conference and Super Bowl based on change
10. ✅ Create participant predictions and verify scoring works

**Time Estimate**: 15-20 minutes for full critical path

---

## Regression Checks

Before marking as ready to deploy, verify these still work:

- ✅ Creating lobbies
- ✅ Adding participants
- ✅ Submitting predictions
- ✅ Viewing leaderboards
- ✅ Deleting participants/lobbies
- ✅ Multiple seasons
- ✅ All 95 automated tests pass

---

## Known Limitations (Expected Behavior)

1. **Re-seeding is global**: All lobbies for a season see the same actual matchups
2. **No undo**: Once a winner is changed, previous downstream winners are permanently cleared
3. **Manual updates only**: Automatic ESPN score updates trigger re-seeding, but must be manually initiated
4. **Seed preservation**: Teams must be entered exactly as they were seeded for seed numbers to display

## Success Criteria

All tests in Test Suites 1-8 pass without errors, and the Critical Path Test completes successfully.
