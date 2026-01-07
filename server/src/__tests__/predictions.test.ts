import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDatabase, createTestSeason, createTestLobby, getGames } from '../test-utils/database.js';
import { addParticipant, addPrediction, getPredictionsByParticipant, getParticipantById } from '../services/lobby.js';

describe('Prediction Submission & Validation', () => {
  let seasonId: number;
  let lobbyId: string;
  let games: any[];

  beforeEach(async () => {
    await setupTestDatabase();

    const { season } = await createTestSeason();
    seasonId = season.id;

    const { lobby } = await createTestLobby(seasonId);
    lobbyId = lobby.id;

    games = await getGames(seasonId);
  });

  describe('Valid Submission', () => {
    it('should create participant and store predictions', async () => {
      const participant = await addParticipant(lobbyId, 'Test Player');

      expect(participant).toBeDefined();
      expect(participant.name).toBe('Test Player');
      expect(participant.lobby_id).toBe(lobbyId);

      // Add a prediction
      const game = games[0];
      await addPrediction(participant.id, game.id, game.team_home, game.team_away);

      // Verify prediction was saved
      const predictions = await getPredictionsByParticipant(participant.id);
      expect(predictions).toHaveLength(1);
      expect(predictions[0].predicted_winner).toBe(game.team_home);
      expect(predictions[0].predicted_opponent).toBe(game.team_away);
    });

    it('should handle complete predictions for all games', async () => {
      const participant = await addParticipant(lobbyId, 'Complete Player');

      // Add predictions for all games
      for (const game of games) {
        await addPrediction(participant.id, game.id, game.team_home, game.team_away);
      }

      const predictions = await getPredictionsByParticipant(participant.id);
      expect(predictions).toHaveLength(games.length);
    });

    it('should handle partial predictions (some games left blank)', async () => {
      const participant = await addParticipant(lobbyId, 'Partial Player');

      // Only predict first 3 games
      const wildCardGames = games.filter(g => g.round === 'wild_card').slice(0, 3);

      for (const game of wildCardGames) {
        await addPrediction(participant.id, game.id, game.team_home);
      }

      const predictions = await getPredictionsByParticipant(participant.id);
      expect(predictions).toHaveLength(3);
    });

    it('should correctly save predicted_opponent field', async () => {
      const participant = await addParticipant(lobbyId, 'Test Player');
      const game = games.find(g => g.round === 'wild_card');

      await addPrediction(participant.id, game.id, game.team_home, game.team_away);

      const predictions = await getPredictionsByParticipant(participant.id);
      expect(predictions[0].predicted_winner).toBe(game.team_home);
      expect(predictions[0].predicted_opponent).toBe(game.team_away);
    });

    it('should handle null predicted_opponent', async () => {
      const participant = await addParticipant(lobbyId, 'Test Player');
      const game = games.find(g => g.round === 'wild_card');

      // Don't specify opponent
      await addPrediction(participant.id, game.id, game.team_home);

      const predictions = await getPredictionsByParticipant(participant.id);
      expect(predictions[0].predicted_winner).toBe(game.team_home);
      expect(predictions[0].predicted_opponent).toBeNull();
    });
  });

  describe('Data Integrity', () => {
    it('should link predictions to correct participant', async () => {
      const participant1 = await addParticipant(lobbyId, 'Player 1');
      const participant2 = await addParticipant(lobbyId, 'Player 2');

      const game = games[0];

      await addPrediction(participant1.id, game.id, game.team_home);
      await addPrediction(participant2.id, game.id, game.team_away);

      const predictions1 = await getPredictionsByParticipant(participant1.id);
      const predictions2 = await getPredictionsByParticipant(participant2.id);

      expect(predictions1).toHaveLength(1);
      expect(predictions1[0].predicted_winner).toBe(game.team_home);

      expect(predictions2).toHaveLength(1);
      expect(predictions2[0].predicted_winner).toBe(game.team_away);
    });

    it('should link participant to correct lobby', async () => {
      const participant = await addParticipant(lobbyId, 'Test Player');

      expect(participant.lobby_id).toBe(lobbyId);

      // Verify we can retrieve it
      const retrieved = await getParticipantById(participant.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.lobby_id).toBe(lobbyId);
    });

    it('should handle multiple participants in same lobby', async () => {
      const participant1 = await addParticipant(lobbyId, 'Player 1');
      const participant2 = await addParticipant(lobbyId, 'Player 2');
      const participant3 = await addParticipant(lobbyId, 'Player 3');

      expect(participant1.lobby_id).toBe(lobbyId);
      expect(participant2.lobby_id).toBe(lobbyId);
      expect(participant3.lobby_id).toBe(lobbyId);

      // All should have different IDs
      expect(participant1.id).not.toBe(participant2.id);
      expect(participant2.id).not.toBe(participant3.id);
    });

    it('should maintain data integrity when same player predicts multiple games', async () => {
      const participant = await addParticipant(lobbyId, 'Multi-Game Player');

      const game1 = games[0];
      const game2 = games[1];
      const game3 = games[2];

      await addPrediction(participant.id, game1.id, 'TEAM1');
      await addPrediction(participant.id, game2.id, 'TEAM2');
      await addPrediction(participant.id, game3.id, 'TEAM3');

      const predictions = await getPredictionsByParticipant(participant.id);

      expect(predictions).toHaveLength(3);
      expect(predictions.find(p => p.game_id === game1.id)!.predicted_winner).toBe('TEAM1');
      expect(predictions.find(p => p.game_id === game2.id)!.predicted_winner).toBe('TEAM2');
      expect(predictions.find(p => p.game_id === game3.id)!.predicted_winner).toBe('TEAM3');
    });
  });

  describe('Edge Cases', () => {
    it('should handle participant names with special characters', async () => {
      const participant = await addParticipant(lobbyId, "Player O'Brien");

      expect(participant.name).toBe("Player O'Brien");

      const retrieved = await getParticipantById(participant.id);
      expect(retrieved!.name).toBe("Player O'Brien");
    });

    it('should handle long participant names', async () => {
      const longName = 'A'.repeat(100);
      const participant = await addParticipant(lobbyId, longName);

      expect(participant.name).toBe(longName);
    });

    it('should handle predictions with same winner and opponent', async () => {
      const participant = await addParticipant(lobbyId, 'Test Player');
      const game = games[0];

      // Edge case: predicted_opponent same as predicted_winner (shouldn't happen, but test data integrity)
      await addPrediction(participant.id, game.id, 'TEAM1', 'TEAM1');

      const predictions = await getPredictionsByParticipant(participant.id);
      expect(predictions[0].predicted_winner).toBe('TEAM1');
      expect(predictions[0].predicted_opponent).toBe('TEAM1');
    });

    it('should return empty array when participant has no predictions', async () => {
      const participant = await addParticipant(lobbyId, 'No Predictions');

      const predictions = await getPredictionsByParticipant(participant.id);
      expect(predictions).toHaveLength(0);
    });

    it('should handle whitespace in team names', async () => {
      const participant = await addParticipant(lobbyId, 'Test Player');
      const game = games[0];

      await addPrediction(participant.id, game.id, ' TEAM ', ' OPPONENT ');

      const predictions = await getPredictionsByParticipant(participant.id);
      // Note: The application doesn't trim whitespace - this is intentional for testing
      expect(predictions[0].predicted_winner).toBe(' TEAM ');
      expect(predictions[0].predicted_opponent).toBe(' OPPONENT ');
    });
  });

  describe('Participant Retrieval', () => {
    it('should retrieve participant by ID', async () => {
      const participant = await addParticipant(lobbyId, 'Findable Player');

      const retrieved = await getParticipantById(participant.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(participant.id);
      expect(retrieved!.name).toBe('Findable Player');
      expect(retrieved!.lobby_id).toBe(lobbyId);
    });

    it('should return undefined for non-existent participant', async () => {
      const retrieved = await getParticipantById(99999);

      expect(retrieved).toBeUndefined();
    });
  });

  describe('Multiple Lobbies', () => {
    it('should keep participants separate across lobbies', async () => {
      // Create second lobby
      const { lobby: lobby2 } = await createTestLobby(seasonId, 'Second Lobby');

      const participant1 = await addParticipant(lobbyId, 'Lobby 1 Player');
      const participant2 = await addParticipant(lobby2.id, 'Lobby 2 Player');

      expect(participant1.lobby_id).toBe(lobbyId);
      expect(participant2.lobby_id).toBe(lobby2.id);
      expect(participant1.lobby_id).not.toBe(participant2.lobby_id);
    });

    it('should keep predictions separate across lobbies', async () => {
      const { lobby: lobby2 } = await createTestLobby(seasonId, 'Second Lobby');

      const participant1 = await addParticipant(lobbyId, 'Player 1');
      const participant2 = await addParticipant(lobby2.id, 'Player 2');

      const game = games[0];

      await addPrediction(participant1.id, game.id, 'TEAM_A');
      await addPrediction(participant2.id, game.id, 'TEAM_B');

      const predictions1 = await getPredictionsByParticipant(participant1.id);
      const predictions2 = await getPredictionsByParticipant(participant2.id);

      expect(predictions1[0].predicted_winner).toBe('TEAM_A');
      expect(predictions2[0].predicted_winner).toBe('TEAM_B');
    });
  });

  describe('Timestamps', () => {
    it('should set submitted_at timestamp when participant is created', async () => {
      const participant = await addParticipant(lobbyId, 'Timestamped Player');

      expect(participant.submitted_at).toBeDefined();

      // Verify it's a valid date string
      const submittedTime = new Date(participant.submitted_at);
      expect(submittedTime.getTime()).toBeGreaterThan(0);

      // Verify it's reasonably recent (within last hour)
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      expect(submittedTime.getTime()).toBeGreaterThan(oneHourAgo);
    });
  });

  describe('Prediction for Different Rounds', () => {
    it('should handle predictions for all playoff rounds', async () => {
      const participant = await addParticipant(lobbyId, 'Full Bracket Player');

      const wildCardGame = games.find(g => g.round === 'wild_card');
      const divisionalGame = games.find(g => g.round === 'divisional');
      const conferenceGame = games.find(g => g.round === 'conference');
      const superBowlGame = games.find(g => g.round === 'super_bowl');

      await addPrediction(participant.id, wildCardGame.id, 'WC_TEAM');
      await addPrediction(participant.id, divisionalGame.id, 'DIV_TEAM');
      await addPrediction(participant.id, conferenceGame.id, 'CONF_TEAM');
      await addPrediction(participant.id, superBowlGame.id, 'SB_TEAM');

      const predictions = await getPredictionsByParticipant(participant.id);

      expect(predictions).toHaveLength(4);
      expect(predictions.find(p => p.game_id === wildCardGame.id)).toBeDefined();
      expect(predictions.find(p => p.game_id === divisionalGame.id)).toBeDefined();
      expect(predictions.find(p => p.game_id === conferenceGame.id)).toBeDefined();
      expect(predictions.find(p => p.game_id === superBowlGame.id)).toBeDefined();
    });
  });
});
