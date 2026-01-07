import { initializeDatabase, runQuery, runInsert, runExec } from '../db/schema.js';
import { createSeason, addGameToSeason, setPlayoffSeed, generatePlayoffGamesFromSeeds } from '../services/season.js';
import { createLobby, addParticipant, addPrediction } from '../services/lobby.js';
import { createAdmin } from '../auth/auth.js';
import type { Season, Lobby, Game, Participant } from '../db/schema.js';

/**
 * Reset and initialize the test database
 */
export async function setupTestDatabase(): Promise<void> {
  await initializeDatabase();

  // Clear all tables
  await runExec('DELETE FROM predictions', []);
  await runExec('DELETE FROM participants', []);
  await runExec('DELETE FROM lobbies', []);
  await runExec('DELETE FROM games', []);
  await runExec('DELETE FROM playoff_seeds', []);
  await runExec('DELETE FROM seasons', []);
  await runExec('DELETE FROM admins', []);
}

/**
 * Create a test season with playoff seeds
 */
export async function createTestSeason(
  name: string = 'Test Season 2025',
  year: number = 2025
): Promise<{ season: Season; seeds: any[] }> {
  const season = await createSeason(name, year, 'NFL');

  // Create playoff seeds for both conferences
  const afcSeeds = [
    { conference: 'AFC', seed: 1, team_abbr: 'Chiefs' },
    { conference: 'AFC', seed: 2, team_abbr: 'Bills' },
    { conference: 'AFC', seed: 3, team_abbr: 'Ravens' },
    { conference: 'AFC', seed: 4, team_abbr: 'Texans' },
    { conference: 'AFC', seed: 5, team_abbr: 'Browns' },
    { conference: 'AFC', seed: 6, team_abbr: 'Dolphins' },
    { conference: 'AFC', seed: 7, team_abbr: 'Steelers' },
  ];

  const nfcSeeds = [
    { conference: 'NFC', seed: 1, team_abbr: '49ers' },
    { conference: 'NFC', seed: 2, team_abbr: 'Cowboys' },
    { conference: 'NFC', seed: 3, team_abbr: 'Lions' },
    { conference: 'NFC', seed: 4, team_abbr: 'Buccaneers' },
    { conference: 'NFC', seed: 5, team_abbr: 'Eagles' },
    { conference: 'NFC', seed: 6, team_abbr: 'Rams' },
    { conference: 'NFC', seed: 7, team_abbr: 'Packers' },
  ];

  const allSeeds = [...afcSeeds, ...nfcSeeds];

  for (const seed of allSeeds) {
    await setPlayoffSeed(season.id, seed.conference as 'AFC' | 'NFC', seed.seed, seed.team_abbr);
  }

  // Generate playoff games from seeds
  await generatePlayoffGamesFromSeeds(season.id);

  return { season, seeds: allSeeds };
}

/**
 * Create a test lobby
 */
let adminCounter = 0;
export async function createTestLobby(
  seasonId: number,
  name: string = 'Test Lobby',
  scoringType: Lobby['scoring_type'] = 'both'
): Promise<{ lobby: Lobby; admin: any }> {
  // Create admin with unique username
  adminCounter++;
  const admin = await createAdmin(`testadmin${adminCounter}`, 'password123', false);

  const lobby = await createLobby(admin.id, seasonId, name, scoringType);

  return { lobby, admin };
}

/**
 * Create a test participant with predictions
 */
export async function createTestParticipant(
  lobbyId: string,
  name: string,
  predictions: Array<{ gameId: number; predictedWinner: string; predictedOpponent?: string }>
): Promise<Participant> {
  const participant = await addParticipant(lobbyId, name);

  for (const pred of predictions) {
    await addPrediction(participant.id, pred.gameId, pred.predictedWinner, pred.predictedOpponent);
  }

  return participant;
}

/**
 * Update game winner (simulates completing a game)
 */
export async function setGameWinner(gameId: number, winner: string): Promise<void> {
  await runExec('UPDATE games SET winner = ?, completed = 1 WHERE id = ?', [winner, gameId]);
}

/**
 * Get all games for a season
 */
export async function getGames(seasonId: number): Promise<Game[]> {
  return runQuery<Game>('SELECT * FROM games WHERE season_id = ? ORDER BY round, game_number', [seasonId]);
}
