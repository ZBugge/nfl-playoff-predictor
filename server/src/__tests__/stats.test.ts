import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDatabase, createTestSeason, createTestLobby, createTestParticipant, getGames } from '../test-utils/database.js';
import { getSystemStats } from '../services/stats.js';
import { createAdmin } from '../auth/auth.js';
import { createLobby, addParticipant } from '../services/lobby.js';

describe('System Stats', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  describe('Totals', () => {
    it('should return correct totals for admins, lobbies, and participants', async () => {
      // Create season
      const { season } = await createTestSeason();
      const games = await getGames(season.id);

      // Create 2 lobbies with different admins
      const { lobby: lobby1 } = await createTestLobby(season.id, 'Lobby 1');
      const { lobby: lobby2 } = await createTestLobby(season.id, 'Lobby 2');

      // Add participants
      await createTestParticipant(lobby1.id, 'Player 1', [
        { gameId: games[0].id, predictedWinner: games[0].team_home }
      ]);
      await createTestParticipant(lobby1.id, 'Player 2', [
        { gameId: games[0].id, predictedWinner: games[0].team_home }
      ]);
      await createTestParticipant(lobby2.id, 'Player 3', [
        { gameId: games[0].id, predictedWinner: games[0].team_home }
      ]);

      const stats = await getSystemStats();

      expect(stats.totals.admins).toBe(2); // 2 admins created by createTestLobby
      expect(stats.totals.lobbies).toBe(2);
      expect(stats.totals.participants).toBe(3);
    });

    it('should return zeros when no data exists', async () => {
      const stats = await getSystemStats();

      expect(stats.totals.admins).toBe(0);
      expect(stats.totals.lobbies).toBe(0);
      expect(stats.totals.participants).toBe(0);
      expect(stats.topLobbies).toHaveLength(0);
      expect(stats.topAdmins).toHaveLength(0);
    });
  });

  describe('Season Filtering', () => {
    it('should filter stats by season', async () => {
      // Create two seasons
      const { season: season1 } = await createTestSeason('Season 2024', 2024);
      const { season: season2 } = await createTestSeason('Season 2025', 2025);

      const games1 = await getGames(season1.id);
      const games2 = await getGames(season2.id);

      // Create lobby in season 1
      const { lobby: lobby1 } = await createTestLobby(season1.id, 'Season 1 Lobby');
      await createTestParticipant(lobby1.id, 'Player A', [
        { gameId: games1[0].id, predictedWinner: games1[0].team_home }
      ]);
      await createTestParticipant(lobby1.id, 'Player B', [
        { gameId: games1[0].id, predictedWinner: games1[0].team_home }
      ]);

      // Create lobby in season 2
      const { lobby: lobby2 } = await createTestLobby(season2.id, 'Season 2 Lobby');
      await createTestParticipant(lobby2.id, 'Player C', [
        { gameId: games2[0].id, predictedWinner: games2[0].team_home }
      ]);

      // Check stats for season 1
      const stats1 = await getSystemStats(season1.id);
      expect(stats1.totals.lobbies).toBe(1);
      expect(stats1.totals.participants).toBe(2);

      // Check stats for season 2
      const stats2 = await getSystemStats(season2.id);
      expect(stats2.totals.lobbies).toBe(1);
      expect(stats2.totals.participants).toBe(1);

      // Check all seasons
      const allStats = await getSystemStats();
      expect(allStats.totals.lobbies).toBe(2);
      expect(allStats.totals.participants).toBe(3);
    });

    it('should return empty data for season with no lobbies', async () => {
      const { season: season1 } = await createTestSeason('Season 2024', 2024);
      const { season: season2 } = await createTestSeason('Season 2025', 2025);

      const games1 = await getGames(season1.id);

      // Only create lobby in season 1
      const { lobby } = await createTestLobby(season1.id, 'Season 1 Lobby');
      await createTestParticipant(lobby.id, 'Player A', [
        { gameId: games1[0].id, predictedWinner: games1[0].team_home }
      ]);

      // Check stats for empty season 2
      const stats2 = await getSystemStats(season2.id);
      expect(stats2.totals.lobbies).toBe(0);
      expect(stats2.totals.participants).toBe(0);
      expect(stats2.topLobbies).toHaveLength(0);
    });
  });

  describe('Top Lobbies', () => {
    it('should return top 3 lobbies sorted by participant count', async () => {
      const { season } = await createTestSeason();
      const games = await getGames(season.id);

      // Create 4 lobbies with different participant counts
      const { lobby: lobby1 } = await createTestLobby(season.id, 'Small Lobby');
      const { lobby: lobby2 } = await createTestLobby(season.id, 'Medium Lobby');
      const { lobby: lobby3 } = await createTestLobby(season.id, 'Large Lobby');
      const { lobby: lobby4 } = await createTestLobby(season.id, 'Huge Lobby');

      // Add different numbers of participants
      // Small: 1 participant
      await createTestParticipant(lobby1.id, 'P1', [{ gameId: games[0].id, predictedWinner: games[0].team_home }]);

      // Medium: 2 participants
      await createTestParticipant(lobby2.id, 'P2', [{ gameId: games[0].id, predictedWinner: games[0].team_home }]);
      await createTestParticipant(lobby2.id, 'P3', [{ gameId: games[0].id, predictedWinner: games[0].team_home }]);

      // Large: 3 participants
      await createTestParticipant(lobby3.id, 'P4', [{ gameId: games[0].id, predictedWinner: games[0].team_home }]);
      await createTestParticipant(lobby3.id, 'P5', [{ gameId: games[0].id, predictedWinner: games[0].team_home }]);
      await createTestParticipant(lobby3.id, 'P6', [{ gameId: games[0].id, predictedWinner: games[0].team_home }]);

      // Huge: 5 participants
      await createTestParticipant(lobby4.id, 'P7', [{ gameId: games[0].id, predictedWinner: games[0].team_home }]);
      await createTestParticipant(lobby4.id, 'P8', [{ gameId: games[0].id, predictedWinner: games[0].team_home }]);
      await createTestParticipant(lobby4.id, 'P9', [{ gameId: games[0].id, predictedWinner: games[0].team_home }]);
      await createTestParticipant(lobby4.id, 'P10', [{ gameId: games[0].id, predictedWinner: games[0].team_home }]);
      await createTestParticipant(lobby4.id, 'P11', [{ gameId: games[0].id, predictedWinner: games[0].team_home }]);

      const stats = await getSystemStats();

      // Should only return top 3
      expect(stats.topLobbies).toHaveLength(3);

      // Should be sorted by participant count descending
      expect(stats.topLobbies[0].name).toBe('Huge Lobby');
      expect(stats.topLobbies[0].participantCount).toBe(5);

      expect(stats.topLobbies[1].name).toBe('Large Lobby');
      expect(stats.topLobbies[1].participantCount).toBe(3);

      expect(stats.topLobbies[2].name).toBe('Medium Lobby');
      expect(stats.topLobbies[2].participantCount).toBe(2);
    });
  });

  describe('Top Admins', () => {
    it('should return top 3 admins sorted by lobby count and total participants', async () => {
      const { season } = await createTestSeason();
      const games = await getGames(season.id);

      // Create admins manually to control the data
      const admin1 = await createAdmin('admin_active', 'pass', false);
      const admin2 = await createAdmin('admin_medium', 'pass', false);
      const admin3 = await createAdmin('admin_small', 'pass', false);
      const admin4 = await createAdmin('admin_tiny', 'pass', false);

      // Admin 1: 3 lobbies, many participants
      const lobby1a = await createLobby(admin1.id, season.id, 'Admin1 Lobby A', 'both');
      const lobby1b = await createLobby(admin1.id, season.id, 'Admin1 Lobby B', 'both');
      const lobby1c = await createLobby(admin1.id, season.id, 'Admin1 Lobby C', 'both');
      await addParticipant(lobby1a.id, 'P1');
      await addParticipant(lobby1a.id, 'P2');
      await addParticipant(lobby1b.id, 'P3');
      await addParticipant(lobby1c.id, 'P4');

      // Admin 2: 2 lobbies
      const lobby2a = await createLobby(admin2.id, season.id, 'Admin2 Lobby A', 'both');
      const lobby2b = await createLobby(admin2.id, season.id, 'Admin2 Lobby B', 'both');
      await addParticipant(lobby2a.id, 'P5');
      await addParticipant(lobby2b.id, 'P6');

      // Admin 3: 1 lobby
      const lobby3a = await createLobby(admin3.id, season.id, 'Admin3 Lobby A', 'both');
      await addParticipant(lobby3a.id, 'P7');

      // Admin 4: 1 lobby (tie with admin3 but fewer participants)
      const lobby4a = await createLobby(admin4.id, season.id, 'Admin4 Lobby A', 'both');
      // No participants

      const stats = await getSystemStats();

      // Should only return top 3 (admins with lobbies)
      expect(stats.topAdmins).toHaveLength(3);

      // Should be sorted by lobby count, then total participants
      expect(stats.topAdmins[0].username).toBe('admin_active');
      expect(stats.topAdmins[0].lobbyCount).toBe(3);
      expect(stats.topAdmins[0].totalParticipants).toBe(4);

      expect(stats.topAdmins[1].username).toBe('admin_medium');
      expect(stats.topAdmins[1].lobbyCount).toBe(2);
      expect(stats.topAdmins[1].totalParticipants).toBe(2);

      expect(stats.topAdmins[2].username).toBe('admin_small');
      expect(stats.topAdmins[2].lobbyCount).toBe(1);
      expect(stats.topAdmins[2].totalParticipants).toBe(1);
    });

    it('should not include admins with zero lobbies', async () => {
      const { season } = await createTestSeason();

      // Create admin with no lobbies
      await createAdmin('admin_no_lobbies', 'pass', false);

      // Create admin with lobby
      const adminWithLobby = await createAdmin('admin_with_lobby', 'pass', false);
      await createLobby(adminWithLobby.id, season.id, 'Test Lobby', 'both');

      const stats = await getSystemStats();

      // Should only include admin with lobbies
      expect(stats.topAdmins).toHaveLength(1);
      expect(stats.topAdmins[0].username).toBe('admin_with_lobby');
    });
  });
});
