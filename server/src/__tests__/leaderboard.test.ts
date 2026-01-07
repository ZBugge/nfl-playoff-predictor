import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDatabase, createTestSeason, createTestLobby, createTestParticipant, setGameWinner, getGames } from '../test-utils/database.js';
import { calculateLeaderboard } from '../services/leaderboard.js';

describe('Leaderboard Scoring Calculations', () => {
  let seasonId: number;
  let lobbyId: string;
  let games: any[];

  beforeEach(async () => {
    // Reset database to clean state
    await setupTestDatabase();

    // Create season with playoff seeds and games
    const { season } = await createTestSeason();
    seasonId = season.id;

    // Create lobby
    const { lobby } = await createTestLobby(seasonId, 'Test Lobby', 'both');
    lobbyId = lobby.id;

    // Get all games
    games = await getGames(seasonId);
  });

  describe('Simple Scoring', () => {
    it('should award 1 point for correct winner in correct matchup', async () => {
      // Get first Wild Card game (should be #2 BUF vs #7 PIT)
      const wildCardGame = games.find(g => g.round === 'wild_card' && g.game_number === 1);

      // Participant predicts correctly
      await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: wildCardGame.id, predictedWinner: wildCardGame.team_home, predictedOpponent: wildCardGame.team_away }
      ]);

      // Set actual winner
      await setGameWinner(wildCardGame.id, wildCardGame.team_home);

      // Calculate leaderboard
      const leaderboard = await calculateLeaderboard(lobbyId, seasonId, 'simple');

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].simpleScore).toBe(1);
      expect(leaderboard[0].correctPicks).toBe(1);
    });

    it('should award 0 points for wrong winner', async () => {
      // Get first Wild Card game
      const wildCardGame = games.find(g => g.round === 'wild_card' && g.game_number === 1);

      // Participant predicts wrong winner
      await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: wildCardGame.id, predictedWinner: wildCardGame.team_away, predictedOpponent: wildCardGame.team_home }
      ]);

      // Set actual winner (opposite of prediction)
      await setGameWinner(wildCardGame.id, wildCardGame.team_home);

      // Calculate leaderboard
      const leaderboard = await calculateLeaderboard(lobbyId, seasonId, 'simple');

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].simpleScore).toBe(0);
      expect(leaderboard[0].correctPicks).toBe(0);
    });

    it('should not award points for incomplete games', async () => {
      // Get first Wild Card game
      const wildCardGame = games.find(g => g.round === 'wild_card' && g.game_number === 1);

      // Participant makes prediction
      await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: wildCardGame.id, predictedWinner: wildCardGame.team_home, predictedOpponent: wildCardGame.team_away }
      ]);

      // Don't set winner (game incomplete)

      // Calculate leaderboard
      const leaderboard = await calculateLeaderboard(lobbyId, seasonId, 'simple');

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].simpleScore).toBe(0);
      expect(leaderboard[0].correctPicks).toBe(0);
      expect(leaderboard[0].totalPicks).toBe(1);
    });
  });

  describe('Weighted Scoring', () => {
    it('should award different points per round', async () => {
      const wildCardGame = games.find(g => g.round === 'wild_card');
      const divisionalGame = games.find(g => g.round === 'divisional');
      const conferenceGame = games.find(g => g.round === 'conference');
      const superBowlGame = games.find(g => g.round === 'super_bowl');

      // Participant predicts all games correctly
      await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: wildCardGame.id, predictedWinner: 'BUF' },
        { gameId: divisionalGame.id, predictedWinner: 'KC' },
        { gameId: conferenceGame.id, predictedWinner: 'KC' },
        { gameId: superBowlGame.id, predictedWinner: 'KC' },
      ]);

      // Set winners for all games
      await setGameWinner(wildCardGame.id, 'BUF');
      await setGameWinner(divisionalGame.id, 'KC');
      await setGameWinner(conferenceGame.id, 'KC');
      await setGameWinner(superBowlGame.id, 'KC');

      // Calculate leaderboard
      const leaderboard = await calculateLeaderboard(lobbyId, seasonId, 'weighted');

      expect(leaderboard).toHaveLength(1);
      // Wild Card: 1, Divisional: 2, Conference: 3, Super Bowl: 5
      expect(leaderboard[0].weightedScore).toBe(11); // 1 + 2 + 3 + 5
      expect(leaderboard[0].correctPicks).toBe(4);
    });

    it('should correctly score Super Bowl predictions', async () => {
      const superBowlGame = games.find(g => g.round === 'super_bowl');

      // Participant predicts correctly
      await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: superBowlGame.id, predictedWinner: 'KC' }
      ]);

      // Set actual winner
      await setGameWinner(superBowlGame.id, 'KC');

      // Calculate leaderboard
      const leaderboard = await calculateLeaderboard(lobbyId, seasonId, 'weighted');

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].weightedScore).toBe(5); // Super Bowl is worth 5 points
    });
  });

  describe('Both Scoring Mode', () => {
    it('should calculate both simple and weighted scores', async () => {
      const wildCardGame = games.find(g => g.round === 'wild_card');
      const divisionalGame = games.find(g => g.round === 'divisional');

      // Participant predicts both games correctly
      await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: wildCardGame.id, predictedWinner: 'BUF' },
        { gameId: divisionalGame.id, predictedWinner: 'KC' },
      ]);

      // Set winners
      await setGameWinner(wildCardGame.id, 'BUF');
      await setGameWinner(divisionalGame.id, 'KC');

      // Calculate leaderboard with 'both' scoring
      const leaderboard = await calculateLeaderboard(lobbyId, seasonId, 'both');

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].simpleScore).toBe(2); // 1 + 1
      expect(leaderboard[0].weightedScore).toBe(3); // 1 + 2
    });

    it('should sort by simple score when using both mode', async () => {
      const wildCardGame = games.find(g => g.round === 'wild_card');

      // Player 1 gets it right
      await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: wildCardGame.id, predictedWinner: 'BUF' }
      ]);

      // Player 2 gets it wrong
      await createTestParticipant(lobbyId, 'Player 2', [
        { gameId: wildCardGame.id, predictedWinner: 'PIT' }
      ]);

      // Set winner
      await setGameWinner(wildCardGame.id, 'BUF');

      // Calculate leaderboard
      const leaderboard = await calculateLeaderboard(lobbyId, seasonId, 'both');

      expect(leaderboard).toHaveLength(2);
      expect(leaderboard[0].name).toBe('Player 1');
      expect(leaderboard[1].name).toBe('Player 2');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty lobby (no participants)', async () => {
      const leaderboard = await calculateLeaderboard(lobbyId, seasonId, 'simple');

      expect(leaderboard).toHaveLength(0);
    });

    it('should award full points when predicted_opponent is missing', async () => {
      const wildCardGame = games.find(g => g.round === 'wild_card');

      // Participant predicts without specifying opponent
      await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: wildCardGame.id, predictedWinner: wildCardGame.team_home }
        // No predictedOpponent specified
      ]);

      // Set actual winner
      await setGameWinner(wildCardGame.id, wildCardGame.team_home);

      // Calculate leaderboard
      const leaderboard = await calculateLeaderboard(lobbyId, seasonId, 'simple');

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].simpleScore).toBe(1); // Full points for correct winner
    });

    it('should handle multiple participants with same predictions', async () => {
      const wildCardGame = games.find(g => g.round === 'wild_card');

      // Two participants make same prediction
      await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: wildCardGame.id, predictedWinner: 'BUF' }
      ]);
      await createTestParticipant(lobbyId, 'Player 2', [
        { gameId: wildCardGame.id, predictedWinner: 'BUF' }
      ]);

      // Set winner
      await setGameWinner(wildCardGame.id, 'BUF');

      // Calculate leaderboard
      const leaderboard = await calculateLeaderboard(lobbyId, seasonId, 'simple');

      expect(leaderboard).toHaveLength(2);
      expect(leaderboard[0].simpleScore).toBe(1);
      expect(leaderboard[1].simpleScore).toBe(1);
    });
  });

  describe('Leaderboard Ranking', () => {
    it('should correctly sort by highest points first', async () => {
      const wildCardGame1 = games.find(g => g.round === 'wild_card' && g.game_number === 1);
      const wildCardGame2 = games.find(g => g.round === 'wild_card' && g.game_number === 2);

      // Player 1 gets 1 right
      await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: wildCardGame1.id, predictedWinner: wildCardGame1.team_home }
      ]);

      // Player 2 gets 2 right
      await createTestParticipant(lobbyId, 'Player 2', [
        { gameId: wildCardGame1.id, predictedWinner: wildCardGame1.team_home },
        { gameId: wildCardGame2.id, predictedWinner: wildCardGame2.team_home }
      ]);

      // Player 3 gets 0 right
      await createTestParticipant(lobbyId, 'Player 3', [
        { gameId: wildCardGame1.id, predictedWinner: wildCardGame1.team_away }
      ]);

      // Set winners
      await setGameWinner(wildCardGame1.id, wildCardGame1.team_home);
      await setGameWinner(wildCardGame2.id, wildCardGame2.team_home);

      // Calculate leaderboard
      const leaderboard = await calculateLeaderboard(lobbyId, seasonId, 'simple');

      expect(leaderboard).toHaveLength(3);
      expect(leaderboard[0].name).toBe('Player 2'); // 2 points
      expect(leaderboard[0].simpleScore).toBe(2);
      expect(leaderboard[1].name).toBe('Player 1'); // 1 point
      expect(leaderboard[1].simpleScore).toBe(1);
      expect(leaderboard[2].name).toBe('Player 3'); // 0 points
      expect(leaderboard[2].simpleScore).toBe(0);
    });

    it('should sort by weighted score when scoring type is weighted', async () => {
      const wildCardGame = games.find(g => g.round === 'wild_card');
      const divisionalGame = games.find(g => g.round === 'divisional');

      // Player 1: 1 Wild Card correct (1 point)
      await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: wildCardGame.id, predictedWinner: 'BUF' }
      ]);

      // Player 2: 1 Divisional correct (2 points)
      await createTestParticipant(lobbyId, 'Player 2', [
        { gameId: divisionalGame.id, predictedWinner: 'KC' }
      ]);

      // Set winners
      await setGameWinner(wildCardGame.id, 'BUF');
      await setGameWinner(divisionalGame.id, 'KC');

      // Calculate leaderboard
      const leaderboard = await calculateLeaderboard(lobbyId, seasonId, 'weighted');

      expect(leaderboard).toHaveLength(2);
      expect(leaderboard[0].name).toBe('Player 2'); // 2 weighted points
      expect(leaderboard[0].weightedScore).toBe(2);
      expect(leaderboard[1].name).toBe('Player 1'); // 1 weighted point
      expect(leaderboard[1].weightedScore).toBe(1);
    });
  });
});
