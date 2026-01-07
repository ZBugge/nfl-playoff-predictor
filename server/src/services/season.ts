import { runQuery, runInsert, runExec, type Season, type Game, type PlayoffSeed } from '../db/schema.js';

export async function createSeason(name: string, year: number, sport: string = 'NFL'): Promise<Season> {
  const id = await runInsert(
    'INSERT INTO seasons (name, year, sport) VALUES (?, ?, ?)',
    [name, year, sport]
  );

  return (await getSeasonById(id))!;
}

export async function getSeasonById(id: number): Promise<Season | undefined> {
  const results = await runQuery<Season>('SELECT * FROM seasons WHERE id = ?', [id]);
  return results[0];
}

export async function getAllSeasons(): Promise<Season[]> {
  return runQuery<Season>('SELECT * FROM seasons ORDER BY year DESC, created_at DESC');
}

export async function getActiveSeasons(): Promise<Season[]> {
  return runQuery<Season>('SELECT * FROM seasons WHERE status = ? ORDER BY year DESC', ['active']);
}

export async function updateSeasonStatus(id: number, status: 'active' | 'archived'): Promise<void> {
  await runExec('UPDATE seasons SET status = ? WHERE id = ?', [status, id]);
}

export async function addGameToSeason(
  seasonId: number,
  round: Game['round'],
  teamHome: string,
  teamAway: string,
  espnEventId?: string,
  seedHome?: number,
  seedAway?: number,
  isActualMatchup: boolean = true
): Promise<Game> {
  // Auto-generate game number: find max game_number in this round and add 1
  const existingGames = await getGamesBySeason(seasonId);
  const gamesInRound = existingGames.filter(g => g.round === round);
  const maxGameNumber = gamesInRound.length > 0
    ? Math.max(...gamesInRound.map(g => g.game_number))
    : 0;
  const gameNumber = maxGameNumber + 1;

  const id = await runInsert(
    `INSERT INTO games (season_id, round, game_number, team_home, team_away, espn_event_id, seed_home, seed_away, is_actual_matchup)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [seasonId, round, gameNumber, teamHome, teamAway, espnEventId || null, seedHome || null, seedAway || null, isActualMatchup ? 1 : 0]
  );

  return (await getGameById(id))!;
}

export async function getGameById(id: number): Promise<Game | undefined> {
  const results = await runQuery<Game>('SELECT * FROM games WHERE id = ?', [id]);
  return results[0];
}

export async function getGamesBySeason(seasonId: number): Promise<Game[]> {
  return runQuery<Game>('SELECT * FROM games WHERE season_id = ? ORDER BY round, game_number', [seasonId]);
}

export async function updateGameWinner(gameId: number, winner: string): Promise<void> {
  // Get the game to find its season
  const game = await getGameById(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  // Update the winner
  await runExec('UPDATE games SET winner = ?, completed = 1 WHERE id = ?', [winner, gameId]);

  // Trigger re-seeding to update future rounds
  await reseedPlayoffBracket(game.season_id);
}

export async function deleteGame(gameId: number): Promise<void> {
  await runExec('DELETE FROM games WHERE id = ?', [gameId]);
}

export async function deleteMultipleGames(gameIds: number[]): Promise<void> {
  if (gameIds.length === 0) return;

  const placeholders = gameIds.map(() => '?').join(',');
  await runExec(`DELETE FROM games WHERE id IN (${placeholders})`, gameIds);
}

export async function deleteAllGamesForSeason(seasonId: number): Promise<void> {
  await runExec('DELETE FROM games WHERE season_id = ?', [seasonId]);
}

// Playoff seeding functions
export async function setPlayoffSeed(
  seasonId: number,
  conference: 'AFC' | 'NFC',
  seed: number,
  teamAbbr: string
): Promise<void> {
  await runExec(
    `INSERT OR REPLACE INTO playoff_seeds (season_id, conference, seed, team_abbr)
     VALUES (?, ?, ?, ?)`,
    [seasonId, conference, seed, teamAbbr]
  );
}

export async function getPlayoffSeeds(seasonId: number): Promise<PlayoffSeed[]> {
  return runQuery<PlayoffSeed>(
    'SELECT * FROM playoff_seeds WHERE season_id = ? ORDER BY conference, seed',
    [seasonId]
  );
}

export async function generatePlayoffGamesFromSeeds(seasonId: number): Promise<void> {
  // Get all seeds for this season
  const seeds = await getPlayoffSeeds(seasonId);

  if (seeds.length === 0) {
    throw new Error('No playoff seeds defined for this season');
  }

  // Group by conference
  const afcSeeds = seeds.filter(s => s.conference === 'AFC').sort((a, b) => a.seed - b.seed);
  const nfcSeeds = seeds.filter(s => s.conference === 'NFC').sort((a, b) => a.seed - b.seed);

  if (afcSeeds.length < 7 || nfcSeeds.length < 7) {
    throw new Error('Each conference must have 7 seeds defined');
  }

  // Delete existing games for this season
  await runExec('DELETE FROM games WHERE season_id = ?', [seasonId]);

  // Helper function to generate Wild Card games for a conference
  const generateWildCardGames = async (confSeeds: PlayoffSeed[], gameNumberOffset: number) => {
    // NFL Wild Card matchups: #2 vs #7, #3 vs #6, #4 vs #5
    // Note: Only #1 seed gets bye in current NFL format (7 teams per conference)
    const games = [
      { home: confSeeds[1], away: confSeeds[6] }, // #2 vs #7
      { home: confSeeds[2], away: confSeeds[5] }, // #3 vs #6
      { home: confSeeds[3], away: confSeeds[4] }, // #4 vs #5
    ];

    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      await runInsert(
        `INSERT INTO games (season_id, round, game_number, team_home, team_away, seed_home, seed_away, is_actual_matchup, completed)
         VALUES (?, 'wild_card', ?, ?, ?, ?, ?, 1, 0)`,
        [seasonId, gameNumberOffset + i + 1, game.home.team_abbr, game.away.team_abbr, game.home.seed, game.away.seed]
      );
    }
  };

  // Generate Wild Card games for both conferences
  await generateWildCardGames(afcSeeds, 0);  // Games 1-3 for AFC
  await generateWildCardGames(nfcSeeds, 3);  // Games 4-6 for NFC

  // Helper function to generate placeholder divisional games
  const generateDivisionalPlaceholders = async (conference: string, gameNumberOffset: number) => {
    // Two placeholder divisional games per conference
    for (let i = 0; i < 2; i++) {
      await runInsert(
        `INSERT INTO games (season_id, round, game_number, team_home, team_away, seed_home, seed_away, is_actual_matchup, completed)
         VALUES (?, 'divisional', ?, 'TBD', 'TBD', NULL, NULL, 0, 0)`,
        [seasonId, gameNumberOffset + i + 1]
      );
    }
  };

  // Generate Divisional placeholders for both conferences
  await generateDivisionalPlaceholders('AFC', 0);  // Games 1-2 for AFC
  await generateDivisionalPlaceholders('NFC', 2);  // Games 3-4 for NFC

  // Generate Conference Championship placeholders (one per conference)
  await runInsert(
    `INSERT INTO games (season_id, round, game_number, team_home, team_away, is_actual_matchup, completed)
     VALUES (?, 'conference', 1, 'TBD', 'TBD', 0, 0)`,
    [seasonId]
  );
  await runInsert(
    `INSERT INTO games (season_id, round, game_number, team_home, team_away, is_actual_matchup, completed)
     VALUES (?, 'conference', 2, 'TBD', 'TBD', 0, 0)`,
    [seasonId]
  );

  // Generate Super Bowl placeholder
  await runInsert(
    `INSERT INTO games (season_id, round, game_number, team_home, team_away, is_actual_matchup, completed)
     VALUES (?, 'super_bowl', 1, 'TBD', 'TBD', 0, 0)`,
    [seasonId]
  );
}

/**
 * Re-seed playoff bracket when games are completed.
 * Updates future round matchups based on completed games.
 * Clears downstream winners if matchups change.
 */
export async function reseedPlayoffBracket(seasonId: number): Promise<void> {
  const games = await getGamesBySeason(seasonId);
  const seeds = await getPlayoffSeeds(seasonId);

  // Group games by round
  const wildCardGames = games.filter(g => g.round === 'wild_card');
  const divisionalGames = games.filter(g => g.round === 'divisional');
  const conferenceGames = games.filter(g => g.round === 'conference');
  const superBowlGame = games.find(g => g.round === 'super_bowl');

  // Helper: Check if all games in a round are complete
  const isRoundComplete = (roundGames: Game[]) =>
    roundGames.length > 0 && roundGames.every(g => g.completed && g.winner);

  // Helper: Get seed number for a team
  const getSeedForTeam = (team: string): number | null => {
    const seed = seeds.find(s => s.team_abbr === team);
    return seed ? seed.seed : null;
  };

  // Helper: Get conference for a team
  const getConferenceForTeam = (team: string): 'AFC' | 'NFC' | null => {
    const seed = seeds.find(s => s.team_abbr === team);
    return seed ? seed.conference : null;
  };

  // Re-seed Divisional Round from Wild Card
  if (isRoundComplete(wildCardGames)) {
    // Get AFC and NFC wild card winners
    const afcWildCardGames = wildCardGames.filter(g => g.game_number >= 1 && g.game_number <= 3);
    const nfcWildCardGames = wildCardGames.filter(g => g.game_number >= 4 && g.game_number <= 6);

    // AFC Divisional Re-seeding
    if (afcWildCardGames.every(g => g.winner)) {
      const afcWinners = afcWildCardGames.map(g => ({
        team: g.winner!,
        seed: getSeedForTeam(g.winner!)!,
      })).sort((a, b) => a.seed - b.seed); // Sort by seed (lowest = best)

      // #1 seed plays lowest remaining seed, #2 best plays second-lowest
      const afc1Seed = seeds.find(s => s.conference === 'AFC' && s.seed === 1)!;
      const afcGame1 = { home: afc1Seed.team_abbr, away: afcWinners[2].team }; // #1 vs worst
      const afcGame2 = { home: afcWinners[0].team, away: afcWinners[1].team }; // best vs second-best

      await updateDivisionalGame(divisionalGames[0], afcGame1.home, afcGame1.away, 1, afcWinners[2].seed);
      await updateDivisionalGame(divisionalGames[1], afcGame2.home, afcGame2.away, afcWinners[0].seed, afcWinners[1].seed);
    }

    // NFC Divisional Re-seeding
    if (nfcWildCardGames.every(g => g.winner)) {
      const nfcWinners = nfcWildCardGames.map(g => ({
        team: g.winner!,
        seed: getSeedForTeam(g.winner!)!,
      })).sort((a, b) => a.seed - b.seed);

      const nfc1Seed = seeds.find(s => s.conference === 'NFC' && s.seed === 1)!;
      const nfcGame1 = { home: nfc1Seed.team_abbr, away: nfcWinners[2].team };
      const nfcGame2 = { home: nfcWinners[0].team, away: nfcWinners[1].team };

      await updateDivisionalGame(divisionalGames[2], nfcGame1.home, nfcGame1.away, 1, nfcWinners[2].seed);
      await updateDivisionalGame(divisionalGames[3], nfcGame2.home, nfcGame2.away, nfcWinners[0].seed, nfcWinners[1].seed);
    }
  }

  // Re-seed Conference Championship from Divisional
  if (isRoundComplete(divisionalGames)) {
    const afcDivisionalGames = divisionalGames.filter(g => g.game_number >= 1 && g.game_number <= 2);
    const nfcDivisionalGames = divisionalGames.filter(g => g.game_number >= 3 && g.game_number <= 4);

    // AFC Conference Championship
    if (afcDivisionalGames.every(g => g.winner)) {
      const afcWinners = afcDivisionalGames.map(g => ({
        team: g.winner!,
        seed: getSeedForTeam(g.winner!)!,
      })).sort((a, b) => a.seed - b.seed);

      await updateConferenceGame(conferenceGames[0], afcWinners[0].team, afcWinners[1].team, afcWinners[0].seed, afcWinners[1].seed);
    }

    // NFC Conference Championship
    if (nfcDivisionalGames.every(g => g.winner)) {
      const nfcWinners = nfcDivisionalGames.map(g => ({
        team: g.winner!,
        seed: getSeedForTeam(g.winner!)!,
      })).sort((a, b) => a.seed - b.seed);

      await updateConferenceGame(conferenceGames[1], nfcWinners[0].team, nfcWinners[1].team, nfcWinners[0].seed, nfcWinners[1].seed);
    }
  }

  // Re-seed Super Bowl from Conference Championships
  if (isRoundComplete(conferenceGames) && superBowlGame) {
    const afcChampion = conferenceGames[0].winner!;
    const nfcChampion = conferenceGames[1].winner!;

    await updateSuperBowlGame(superBowlGame, afcChampion, nfcChampion,
      getSeedForTeam(afcChampion), getSeedForTeam(nfcChampion));
  }
}

/**
 * Helper function to update a divisional game matchup
 * Clears winner if matchup changes, and cascades to conference and Super Bowl
 */
async function updateDivisionalGame(
  game: Game,
  teamHome: string,
  teamAway: string,
  seedHome: number | null,
  seedAway: number | null
): Promise<void> {
  // Check if matchup changed
  const matchupChanged = game.team_home !== teamHome || game.team_away !== teamAway;

  if (matchupChanged) {
    // Clear winner and mark as incomplete if matchup changes
    await runExec(
      `UPDATE games SET team_home = ?, team_away = ?, seed_home = ?, seed_away = ?,
       is_actual_matchup = 1, winner = NULL, completed = 0 WHERE id = ?`,
      [teamHome, teamAway, seedHome, seedAway, game.id]
    );

    // Clear downstream conference and Super Bowl winners since divisional matchup changed
    const seasonId = (await runQuery<{ season_id: number }>('SELECT season_id FROM games WHERE id = ?', [game.id]))[0].season_id;

    // Clear conference championship winners (both AFC and NFC to be safe)
    await runExec(
      `UPDATE games SET winner = NULL, completed = 0
       WHERE season_id = ? AND round = 'conference'`,
      [seasonId]
    );

    // Clear Super Bowl winner
    await runExec(
      `UPDATE games SET winner = NULL, completed = 0
       WHERE season_id = ? AND round = 'super_bowl'`,
      [seasonId]
    );
  } else if (!game.is_actual_matchup) {
    // Just mark as actual matchup if teams match
    await runExec(
      `UPDATE games SET team_home = ?, team_away = ?, seed_home = ?, seed_away = ?,
       is_actual_matchup = 1 WHERE id = ?`,
      [teamHome, teamAway, seedHome, seedAway, game.id]
    );
  }
}

/**
 * Helper function to update a conference championship game matchup
 * Clears winner if matchup changes, and cascades to Super Bowl
 */
async function updateConferenceGame(
  game: Game,
  teamHome: string,
  teamAway: string,
  seedHome: number | null,
  seedAway: number | null
): Promise<void> {
  const matchupChanged = game.team_home !== teamHome || game.team_away !== teamAway;

  if (matchupChanged) {
    await runExec(
      `UPDATE games SET team_home = ?, team_away = ?, seed_home = ?, seed_away = ?,
       is_actual_matchup = 1, winner = NULL, completed = 0 WHERE id = ?`,
      [teamHome, teamAway, seedHome, seedAway, game.id]
    );

    // Clear Super Bowl winner since conference champion changed
    await runExec(
      `UPDATE games SET winner = NULL, completed = 0
       WHERE season_id = (SELECT season_id FROM games WHERE id = ?) AND round = 'super_bowl'`,
      [game.id]
    );
  } else if (!game.is_actual_matchup) {
    await runExec(
      `UPDATE games SET team_home = ?, team_away = ?, seed_home = ?, seed_away = ?,
       is_actual_matchup = 1 WHERE id = ?`,
      [teamHome, teamAway, seedHome, seedAway, game.id]
    );
  }
}

/**
 * Helper function to update Super Bowl matchup
 * Clears winner if matchup changes
 */
async function updateSuperBowlGame(
  game: Game,
  teamHome: string,
  teamAway: string,
  seedHome: number | null,
  seedAway: number | null
): Promise<void> {
  const matchupChanged = game.team_home !== teamHome || game.team_away !== teamAway;

  if (matchupChanged) {
    await runExec(
      `UPDATE games SET team_home = ?, team_away = ?, seed_home = ?, seed_away = ?,
       is_actual_matchup = 1, winner = NULL, completed = 0 WHERE id = ?`,
      [teamHome, teamAway, seedHome, seedAway, game.id]
    );
  } else if (!game.is_actual_matchup) {
    await runExec(
      `UPDATE games SET team_home = ?, team_away = ?, seed_home = ?, seed_away = ?,
       is_actual_matchup = 1 WHERE id = ?`,
      [teamHome, teamAway, seedHome, seedAway, game.id]
    );
  }
}
