import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDatabase, createTestSeason, createTestLobby, createTestParticipant, getGames } from '../test-utils/database.js';
import {
  deleteParticipant,
  deleteMultipleParticipants,
  deleteLobby,
  getParticipantsByLobby,
  getParticipantById,
  getPredictionsByParticipant,
  getPredictionsByLobby,
  getLobbyById,
} from '../services/lobby.js';

describe('Cascading Delete Operations', () => {
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

  describe('Delete Single Participant', () => {
    it('should delete participant and all their predictions', async () => {
      // Create participant with predictions
      const participant = await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: games[0].id, predictedWinner: 'TEAM1' },
        { gameId: games[1].id, predictedWinner: 'TEAM2' },
        { gameId: games[2].id, predictedWinner: 'TEAM3' },
      ]);

      // Verify predictions exist
      const predictionsBefore = await getPredictionsByParticipant(participant.id);
      expect(predictionsBefore).toHaveLength(3);

      // Delete participant
      await deleteParticipant(participant.id);

      // Verify participant is deleted
      const participantAfter = await getParticipantById(participant.id);
      expect(participantAfter).toBeUndefined();

      // Verify predictions are deleted
      const predictionsAfter = await getPredictionsByParticipant(participant.id);
      expect(predictionsAfter).toHaveLength(0);
    });

    it('should not affect other participants in the same lobby', async () => {
      // Create two participants
      const participant1 = await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: games[0].id, predictedWinner: 'TEAM1' },
      ]);

      const participant2 = await createTestParticipant(lobbyId, 'Player 2', [
        { gameId: games[0].id, predictedWinner: 'TEAM2' },
      ]);

      // Delete first participant
      await deleteParticipant(participant1.id);

      // Verify second participant still exists
      const participant2After = await getParticipantById(participant2.id);
      expect(participant2After).toBeDefined();
      expect(participant2After!.name).toBe('Player 2');

      // Verify second participant's predictions still exist
      const predictions2 = await getPredictionsByParticipant(participant2.id);
      expect(predictions2).toHaveLength(1);
    });

    it('should handle deleting participant with no predictions', async () => {
      // Create participant without predictions
      const participant = await createTestParticipant(lobbyId, 'Empty Player', []);

      // Delete should succeed
      await deleteParticipant(participant.id);

      // Verify deleted
      const participantAfter = await getParticipantById(participant.id);
      expect(participantAfter).toBeUndefined();
    });

    it('should not throw error when deleting non-existent participant', async () => {
      // This should not throw an error (just silently do nothing)
      await deleteParticipant(99999);

      // No assertions needed - just verifying it doesn't throw
    });
  });

  describe('Bulk Delete Participants', () => {
    it('should delete multiple participants and their predictions', async () => {
      // Create three participants
      const participant1 = await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: games[0].id, predictedWinner: 'TEAM1' },
      ]);

      const participant2 = await createTestParticipant(lobbyId, 'Player 2', [
        { gameId: games[0].id, predictedWinner: 'TEAM2' },
      ]);

      const participant3 = await createTestParticipant(lobbyId, 'Player 3', [
        { gameId: games[0].id, predictedWinner: 'TEAM3' },
      ]);

      // Delete first two
      await deleteMultipleParticipants([participant1.id, participant2.id]);

      // Verify first two are deleted
      expect(await getParticipantById(participant1.id)).toBeUndefined();
      expect(await getParticipantById(participant2.id)).toBeUndefined();

      // Verify third still exists
      expect(await getParticipantById(participant3.id)).toBeDefined();

      // Verify predictions are deleted for first two
      expect(await getPredictionsByParticipant(participant1.id)).toHaveLength(0);
      expect(await getPredictionsByParticipant(participant2.id)).toHaveLength(0);

      // Verify predictions still exist for third
      expect(await getPredictionsByParticipant(participant3.id)).toHaveLength(1);
    });

    it('should handle empty array', async () => {
      // Should not throw error
      await deleteMultipleParticipants([]);

      // No assertions needed
    });

    it('should handle deleting all participants in a lobby', async () => {
      const participant1 = await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: games[0].id, predictedWinner: 'TEAM1' },
      ]);

      const participant2 = await createTestParticipant(lobbyId, 'Player 2', [
        { gameId: games[0].id, predictedWinner: 'TEAM2' },
      ]);

      // Delete all
      await deleteMultipleParticipants([participant1.id, participant2.id]);

      // Verify all deleted
      const remainingParticipants = await getParticipantsByLobby(lobbyId);
      expect(remainingParticipants).toHaveLength(0);

      // Verify all predictions deleted
      const remainingPredictions = await getPredictionsByLobby(lobbyId);
      expect(remainingPredictions).toHaveLength(0);
    });

    it('should handle mix of valid and invalid IDs gracefully', async () => {
      const participant1 = await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: games[0].id, predictedWinner: 'TEAM1' },
      ]);

      // Mix valid and invalid IDs
      await deleteMultipleParticipants([participant1.id, 99999, 88888]);

      // Valid participant should be deleted
      expect(await getParticipantById(participant1.id)).toBeUndefined();
    });
  });

  describe('Delete Entire Lobby', () => {
    it('should delete lobby and all associated data', async () => {
      // Create multiple participants with predictions
      await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: games[0].id, predictedWinner: 'TEAM1' },
        { gameId: games[1].id, predictedWinner: 'TEAM1' },
      ]);

      await createTestParticipant(lobbyId, 'Player 2', [
        { gameId: games[0].id, predictedWinner: 'TEAM2' },
        { gameId: games[1].id, predictedWinner: 'TEAM2' },
      ]);

      await createTestParticipant(lobbyId, 'Player 3', [
        { gameId: games[0].id, predictedWinner: 'TEAM3' },
      ]);

      // Verify data exists
      const participantsBefore = await getParticipantsByLobby(lobbyId);
      const predictionsBefore = await getPredictionsByLobby(lobbyId);

      expect(participantsBefore).toHaveLength(3);
      expect(predictionsBefore.length).toBeGreaterThan(0);

      // Delete lobby
      await deleteLobby(lobbyId);

      // Verify lobby is deleted
      const lobbyAfter = await getLobbyById(lobbyId);
      expect(lobbyAfter).toBeUndefined();

      // Verify all participants are deleted
      const participantsAfter = await getParticipantsByLobby(lobbyId);
      expect(participantsAfter).toHaveLength(0);

      // Verify all predictions are deleted
      const predictionsAfter = await getPredictionsByLobby(lobbyId);
      expect(predictionsAfter).toHaveLength(0);
    });

    it('should handle deleting empty lobby (no participants)', async () => {
      // Lobby has no participants

      // Delete should succeed
      await deleteLobby(lobbyId);

      // Verify deleted
      const lobbyAfter = await getLobbyById(lobbyId);
      expect(lobbyAfter).toBeUndefined();
    });

    it('should not affect other lobbies', async () => {
      // Create second lobby
      const { lobby: lobby2 } = await createTestLobby(seasonId, 'Lobby 2');

      // Add participants to both lobbies
      await createTestParticipant(lobbyId, 'Lobby 1 Player', [
        { gameId: games[0].id, predictedWinner: 'TEAM1' },
      ]);

      await createTestParticipant(lobby2.id, 'Lobby 2 Player', [
        { gameId: games[0].id, predictedWinner: 'TEAM2' },
      ]);

      // Delete first lobby
      await deleteLobby(lobbyId);

      // Verify first lobby is deleted
      expect(await getLobbyById(lobbyId)).toBeUndefined();

      // Verify second lobby still exists
      const lobby2After = await getLobbyById(lobby2.id);
      expect(lobby2After).toBeDefined();

      // Verify second lobby's participants still exist
      const lobby2Participants = await getParticipantsByLobby(lobby2.id);
      expect(lobby2Participants).toHaveLength(1);

      // Verify second lobby's predictions still exist
      const lobby2Predictions = await getPredictionsByLobby(lobby2.id);
      expect(lobby2Predictions).toHaveLength(1);
    });

    it('should handle deleting lobby with many participants', async () => {
      // Create 50 participants sequentially to avoid database race conditions
      for (let i = 1; i <= 50; i++) {
        await createTestParticipant(lobbyId, `Player ${i}`, [
          { gameId: games[0].id, predictedWinner: `TEAM${i}` },
        ]);
      }

      // Verify 50 participants exist
      const participantsBefore = await getParticipantsByLobby(lobbyId);
      expect(participantsBefore).toHaveLength(50);

      // Delete lobby
      await deleteLobby(lobbyId);

      // Verify all deleted
      expect(await getLobbyById(lobbyId)).toBeUndefined();
      expect(await getParticipantsByLobby(lobbyId)).toHaveLength(0);
      expect(await getPredictionsByLobby(lobbyId)).toHaveLength(0);
    });
  });

  describe('Data Integrity After Deletions', () => {
    it('should maintain referential integrity after participant deletion', async () => {
      const participant1 = await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: games[0].id, predictedWinner: 'TEAM1' },
      ]);

      const participant2 = await createTestParticipant(lobbyId, 'Player 2', [
        { gameId: games[1].id, predictedWinner: 'TEAM2' },
      ]);

      // Delete participant 1
      await deleteParticipant(participant1.id);

      // Verify lobby still exists
      const lobby = await getLobbyById(lobbyId);
      expect(lobby).toBeDefined();

      // Verify participant 2's predictions are correct
      const predictions2 = await getPredictionsByParticipant(participant2.id);
      expect(predictions2).toHaveLength(1);
      expect(predictions2[0].game_id).toBe(games[1].id);
    });

    it('should not leave orphaned predictions after lobby deletion', async () => {
      // Create participants
      const participant = await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: games[0].id, predictedWinner: 'TEAM1' },
        { gameId: games[1].id, predictedWinner: 'TEAM1' },
        { gameId: games[2].id, predictedWinner: 'TEAM1' },
      ]);

      // Delete lobby
      await deleteLobby(lobbyId);

      // Verify no predictions remain for the deleted participant
      const predictions = await getPredictionsByParticipant(participant.id);
      expect(predictions).toHaveLength(0);
    });

    it('should maintain correct counts after multiple operations', async () => {
      // Create 5 participants
      const participants = [];
      for (let i = 1; i <= 5; i++) {
        participants.push(
          await createTestParticipant(lobbyId, `Player ${i}`, [
            { gameId: games[0].id, predictedWinner: `TEAM${i}` },
          ])
        );
      }

      // Delete 2 participants
      await deleteParticipant(participants[0].id);
      await deleteParticipant(participants[1].id);

      // Verify correct count
      const remaining = await getParticipantsByLobby(lobbyId);
      expect(remaining).toHaveLength(3);

      // Verify correct predictions count
      const predictions = await getPredictionsByLobby(lobbyId);
      expect(predictions).toHaveLength(3); // 3 remaining participants, 1 prediction each
    });
  });

  describe('Edge Cases', () => {
    it('should handle deleting non-existent lobby', async () => {
      // Should not throw error
      await deleteLobby('non-existent-lobby-id');

      // No assertions needed - just verifying it doesn't throw
    });

    it('should handle bulk delete with single ID', async () => {
      const participant = await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: games[0].id, predictedWinner: 'TEAM1' },
      ]);

      await deleteMultipleParticipants([participant.id]);

      expect(await getParticipantById(participant.id)).toBeUndefined();
    });

    it('should handle deleting participant multiple times', async () => {
      const participant = await createTestParticipant(lobbyId, 'Player 1', [
        { gameId: games[0].id, predictedWinner: 'TEAM1' },
      ]);

      // Delete twice - second should be no-op
      await deleteParticipant(participant.id);
      await deleteParticipant(participant.id);

      // Should still be deleted
      expect(await getParticipantById(participant.id)).toBeUndefined();
    });

    it('should handle deleting lobby twice', async () => {
      // Delete twice - second should be no-op
      await deleteLobby(lobbyId);
      await deleteLobby(lobbyId);

      // Should still be deleted
      expect(await getLobbyById(lobbyId)).toBeUndefined();
    });
  });
});
