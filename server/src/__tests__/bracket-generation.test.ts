import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDatabase, getGames } from '../test-utils/database.js';
import { createSeason, setPlayoffSeed, generatePlayoffGamesFromSeeds, getPlayoffSeeds } from '../services/season.js';

describe('Playoff Bracket Generation from Seeds', () => {
  let seasonId: number;

  beforeEach(async () => {
    await setupTestDatabase();

    const season = await createSeason('Test Season 2025', 2025, 'NFL');
    seasonId = season.id;
  });

  describe('Valid Seeding Input', () => {
    it('should generate correct Wild Card matchups from 7 seeds per conference', async () => {
      // Set up AFC seeds
      await setPlayoffSeed(seasonId, 'AFC', 1, 'KC');
      await setPlayoffSeed(seasonId, 'AFC', 2, 'BUF');
      await setPlayoffSeed(seasonId, 'AFC', 3, 'BAL');
      await setPlayoffSeed(seasonId, 'AFC', 4, 'HOU');
      await setPlayoffSeed(seasonId, 'AFC', 5, 'CLE');
      await setPlayoffSeed(seasonId, 'AFC', 6, 'MIA');
      await setPlayoffSeed(seasonId, 'AFC', 7, 'PIT');

      // Set up NFC seeds
      await setPlayoffSeed(seasonId, 'NFC', 1, 'SF');
      await setPlayoffSeed(seasonId, 'NFC', 2, 'DAL');
      await setPlayoffSeed(seasonId, 'NFC', 3, 'DET');
      await setPlayoffSeed(seasonId, 'NFC', 4, 'TB');
      await setPlayoffSeed(seasonId, 'NFC', 5, 'PHI');
      await setPlayoffSeed(seasonId, 'NFC', 6, 'LA');
      await setPlayoffSeed(seasonId, 'NFC', 7, 'GB');

      // Generate games
      await generatePlayoffGamesFromSeeds(seasonId);

      const games = await getGames(seasonId);
      const wildCardGames = games.filter(g => g.round === 'wild_card');

      // Should have 6 Wild Card games (3 per conference)
      expect(wildCardGames).toHaveLength(6);

      // Verify AFC Wild Card matchups: #2 vs #7, #3 vs #6, #4 vs #5
      const afcWildCard = wildCardGames.filter(g =>
        ['BUF', 'BAL', 'HOU', 'PIT', 'MIA', 'CLE'].includes(g.team_home)
      );
      expect(afcWildCard).toHaveLength(3);

      // Check matchups
      const bufGame = afcWildCard.find(g => g.team_home === 'BUF');
      expect(bufGame).toBeDefined();
      expect(bufGame.seed_home).toBe(2);
      expect(bufGame.seed_away).toBe(7);
      expect(bufGame.team_away).toBe('PIT');

      const balGame = afcWildCard.find(g => g.team_home === 'BAL');
      expect(balGame).toBeDefined();
      expect(balGame.seed_home).toBe(3);
      expect(balGame.seed_away).toBe(6);
      expect(balGame.team_away).toBe('MIA');

      const houGame = afcWildCard.find(g => g.team_home === 'HOU');
      expect(houGame).toBeDefined();
      expect(houGame.seed_home).toBe(4);
      expect(houGame.seed_away).toBe(5);
      expect(houGame.team_away).toBe('CLE');

      // Verify NFC Wild Card matchups
      const nfcWildCard = wildCardGames.filter(g =>
        ['DAL', 'DET', 'TB', 'PHI', 'LA', 'GB'].includes(g.team_home)
      );
      expect(nfcWildCard).toHaveLength(3);
    });

    it('should generate correct number of placeholder games for all rounds', async () => {
      // Set up full seeding
      for (let seed = 1; seed <= 7; seed++) {
        await setPlayoffSeed(seasonId, 'AFC', seed, `AFC${seed}`);
        await setPlayoffSeed(seasonId, 'NFC', seed, `NFC${seed}`);
      }

      await generatePlayoffGamesFromSeeds(seasonId);

      const games = await getGames(seasonId);

      // Count games by round
      const wildCardGames = games.filter(g => g.round === 'wild_card');
      const divisionalGames = games.filter(g => g.round === 'divisional');
      const conferenceGames = games.filter(g => g.round === 'conference');
      const superBowlGames = games.filter(g => g.round === 'super_bowl');

      expect(wildCardGames).toHaveLength(6); // 3 AFC + 3 NFC
      expect(divisionalGames).toHaveLength(4); // 2 AFC + 2 NFC
      expect(conferenceGames).toHaveLength(2); // 1 AFC + 1 NFC
      expect(superBowlGames).toHaveLength(1); // 1 Super Bowl
    });

    it('should set is_actual_matchup correctly', async () => {
      // Set up seeding
      for (let seed = 1; seed <= 7; seed++) {
        await setPlayoffSeed(seasonId, 'AFC', seed, `AFC${seed}`);
        await setPlayoffSeed(seasonId, 'NFC', seed, `NFC${seed}`);
      }

      await generatePlayoffGamesFromSeeds(seasonId);

      const games = await getGames(seasonId);

      // Wild Card games should be actual matchups (is_actual_matchup = 1)
      const wildCardGames = games.filter(g => g.round === 'wild_card');
      wildCardGames.forEach(game => {
        expect(game.is_actual_matchup).toBe(1);
      });

      // All other games should be placeholders (is_actual_matchup = 0)
      const otherGames = games.filter(g => g.round !== 'wild_card');
      otherGames.forEach(game => {
        expect(game.is_actual_matchup).toBe(0);
        expect(game.team_home).toBe('TBD');
        expect(game.team_away).toBe('TBD');
      });
    });

    it('should set correct seed values', async () => {
      // Set up seeding
      for (let seed = 1; seed <= 7; seed++) {
        await setPlayoffSeed(seasonId, 'AFC', seed, `AFC${seed}`);
        await setPlayoffSeed(seasonId, 'NFC', seed, `NFC${seed}`);
      }

      await generatePlayoffGamesFromSeeds(seasonId);

      const games = await getGames(seasonId);
      const wildCardGames = games.filter(g => g.round === 'wild_card');

      // Verify seeds are set correctly for Wild Card
      wildCardGames.forEach(game => {
        expect(game.seed_home).toBeDefined();
        expect(game.seed_away).toBeDefined();
        expect(game.seed_home).toBeGreaterThan(0);
        expect(game.seed_away).toBeGreaterThan(0);
        expect(game.seed_home).toBeLessThan(game.seed_away); // Home team should be higher seed (lower number)
      });

      // Placeholder games should have null seeds
      const placeholderGames = games.filter(g => g.round !== 'wild_card');
      placeholderGames.forEach(game => {
        expect(game.seed_home).toBeNull();
        expect(game.seed_away).toBeNull();
      });
    });
  });

  describe('Invalid Inputs', () => {
    it('should throw error when missing seeds', async () => {
      // Only set 5 seeds instead of 7
      await setPlayoffSeed(seasonId, 'AFC', 1, 'KC');
      await setPlayoffSeed(seasonId, 'AFC', 2, 'BUF');
      await setPlayoffSeed(seasonId, 'AFC', 3, 'BAL');
      await setPlayoffSeed(seasonId, 'AFC', 4, 'HOU');
      await setPlayoffSeed(seasonId, 'AFC', 5, 'CLE');
      // Missing seeds 6 and 7

      // Set all NFC seeds
      for (let seed = 1; seed <= 7; seed++) {
        await setPlayoffSeed(seasonId, 'NFC', seed, `NFC${seed}`);
      }

      // Should throw error
      await expect(generatePlayoffGamesFromSeeds(seasonId)).rejects.toThrow();
    });

    it('should throw error when no seeds defined', async () => {
      // Don't set any seeds

      // Should throw error
      await expect(generatePlayoffGamesFromSeeds(seasonId)).rejects.toThrow('No playoff seeds defined');
    });

    it('should throw error when only one conference has seeds', async () => {
      // Only set AFC seeds
      for (let seed = 1; seed <= 7; seed++) {
        await setPlayoffSeed(seasonId, 'AFC', seed, `AFC${seed}`);
      }

      // Should throw error (NFC missing)
      await expect(generatePlayoffGamesFromSeeds(seasonId)).rejects.toThrow();
    });
  });

  describe('Seed Metadata', () => {
    it('should correctly store and retrieve playoff seeds', async () => {
      await setPlayoffSeed(seasonId, 'AFC', 1, 'KC');
      await setPlayoffSeed(seasonId, 'AFC', 2, 'BUF');

      const seeds = await getPlayoffSeeds(seasonId);

      expect(seeds).toHaveLength(2);
      expect(seeds[0].conference).toBe('AFC');
      expect(seeds[0].seed).toBe(1);
      expect(seeds[0].team_abbr).toBe('KC');
      expect(seeds[1].seed).toBe(2);
      expect(seeds[1].team_abbr).toBe('BUF');
    });

    it('should handle updating existing seed (INSERT OR REPLACE)', async () => {
      // Set initial seed
      await setPlayoffSeed(seasonId, 'AFC', 1, 'KC');

      // Update the same seed
      await setPlayoffSeed(seasonId, 'AFC', 1, 'BUF');

      const seeds = await getPlayoffSeeds(seasonId);
      const seed1 = seeds.find(s => s.seed === 1);

      expect(seed1.team_abbr).toBe('BUF'); // Should be updated
      expect(seeds.filter(s => s.seed === 1)).toHaveLength(1); // Should only have one #1 seed
    });

    it('should allow same team in different conferences', async () => {
      // Hypothetically, if team abbreviations overlapped
      await setPlayoffSeed(seasonId, 'AFC', 1, 'TEAM');
      await setPlayoffSeed(seasonId, 'NFC', 1, 'TEAM');

      const seeds = await getPlayoffSeeds(seasonId);

      expect(seeds).toHaveLength(2);
      expect(seeds.filter(s => s.team_abbr === 'TEAM')).toHaveLength(2);
    });
  });

  describe('Game Numbering', () => {
    it('should assign correct game numbers per round', async () => {
      // Set up full seeding
      for (let seed = 1; seed <= 7; seed++) {
        await setPlayoffSeed(seasonId, 'AFC', seed, `AFC${seed}`);
        await setPlayoffSeed(seasonId, 'NFC', seed, `NFC${seed}`);
      }

      await generatePlayoffGamesFromSeeds(seasonId);

      const games = await getGames(seasonId);

      // Wild Card should have games 1-6
      const wildCardGames = games.filter(g => g.round === 'wild_card');
      const wildCardNumbers = wildCardGames.map(g => g.game_number).sort();
      expect(wildCardNumbers).toEqual([1, 2, 3, 4, 5, 6]);

      // Divisional should have games 1-4
      const divisionalGames = games.filter(g => g.round === 'divisional');
      const divisionalNumbers = divisionalGames.map(g => g.game_number).sort();
      expect(divisionalNumbers).toEqual([1, 2, 3, 4]);

      // Conference should have games 1-2
      const conferenceGames = games.filter(g => g.round === 'conference');
      const conferenceNumbers = conferenceGames.map(g => g.game_number).sort();
      expect(conferenceNumbers).toEqual([1, 2]);

      // Super Bowl should have game 1
      const superBowlGames = games.filter(g => g.round === 'super_bowl');
      expect(superBowlGames).toHaveLength(1);
      expect(superBowlGames[0].game_number).toBe(1);
    });
  });

  describe('Idempotency', () => {
    it('should delete existing games when regenerating bracket', async () => {
      // Set up seeding
      for (let seed = 1; seed <= 7; seed++) {
        await setPlayoffSeed(seasonId, 'AFC', seed, `AFC${seed}`);
        await setPlayoffSeed(seasonId, 'NFC', seed, `NFC${seed}`);
      }

      // Generate games first time
      await generatePlayoffGamesFromSeeds(seasonId);

      const gamesFirstGen = await getGames(seasonId);
      const firstGenCount = gamesFirstGen.length;

      // Update a seed
      await setPlayoffSeed(seasonId, 'AFC', 7, 'NEWTEAM');

      // Regenerate games
      await generatePlayoffGamesFromSeeds(seasonId);

      const gamesSecondGen = await getGames(seasonId);

      // Should have same number of games (old ones deleted, new ones created)
      expect(gamesSecondGen.length).toBe(firstGenCount);

      // Verify the new team is in the games
      const newTeamGame = gamesSecondGen.find(g => g.team_away === 'NEWTEAM' || g.team_home === 'NEWTEAM');
      expect(newTeamGame).toBeDefined();
    });
  });
});
