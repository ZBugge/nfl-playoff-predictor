import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDatabase, createTestSeason, setGameWinner, getGames } from '../test-utils/database.js';
import { updateGameWinner } from '../services/season.js';

describe('Automatic Playoff Bracket Re-seeding', () => {
  let seasonId: number;
  let games: any[];

  beforeEach(async () => {
    await setupTestDatabase();

    const { season } = await createTestSeason();
    seasonId = season.id;

    games = await getGames(seasonId);
  });

  describe('Wild Card to Divisional Re-seeding', () => {
    it('should update divisional matchups when all wild card games are complete', async () => {
      // Wild Card games (AFC games 1-3, NFC games 4-6)
      const wildCardGames = games.filter(g => g.round === 'wild_card');

      // Set winners for AFC Wild Card: #2, #3, #4 all win (chalk)
      await updateGameWinner(wildCardGames[0].id, 'Bills');    // #2 beats #7
      await updateGameWinner(wildCardGames[1].id, 'Ravens');   // #3 beats #6
      await updateGameWinner(wildCardGames[2].id, 'Texans');   // #4 beats #5

      // Set winners for NFC Wild Card
      await updateGameWinner(wildCardGames[3].id, 'Cowboys');    // #2 beats #7
      await updateGameWinner(wildCardGames[4].id, 'Lions');      // #3 beats #6
      await updateGameWinner(wildCardGames[5].id, 'Buccaneers'); // #4 beats #5

      // Fetch updated games
      const updatedGames = await getGames(seasonId);
      const divisionalGames = updatedGames.filter(g => g.round === 'divisional');

      // AFC Divisional should be: #1 Chiefs vs #4 Texans, #2 Bills vs #3 Ravens
      const afcDiv1 = divisionalGames[0];
      const afcDiv2 = divisionalGames[1];

      expect(afcDiv1.team_home).toBe('Chiefs');
      expect(afcDiv1.team_away).toBe('Texans');
      expect(afcDiv1.seed_home).toBe(1);
      expect(afcDiv1.seed_away).toBe(4);
      expect(afcDiv1.is_actual_matchup).toBe(1);

      expect(afcDiv2.team_home).toBe('Bills');
      expect(afcDiv2.team_away).toBe('Ravens');
      expect(afcDiv2.seed_home).toBe(2);
      expect(afcDiv2.seed_away).toBe(3);
      expect(afcDiv2.is_actual_matchup).toBe(1);

      // NFC Divisional should be: #1 49ers vs #4 Buccaneers, #2 Cowboys vs #3 Lions
      const nfcDiv1 = divisionalGames[2];
      const nfcDiv2 = divisionalGames[3];

      expect(nfcDiv1.team_home).toBe('49ers');
      expect(nfcDiv1.team_away).toBe('Buccaneers');
      expect(nfcDiv2.team_home).toBe('Cowboys');
      expect(nfcDiv2.team_away).toBe('Lions');
    });

    it('should handle upsets correctly (lower seeds winning)', async () => {
      const wildCardGames = games.filter(g => g.round === 'wild_card');

      // AFC upsets: #7, #6, #5 all win
      await updateGameWinner(wildCardGames[0].id, 'Steelers');  // #7 beats #2
      await updateGameWinner(wildCardGames[1].id, 'Dolphins');  // #6 beats #3
      await updateGameWinner(wildCardGames[2].id, 'Browns');    // #5 beats #4

      // NFC chalk
      await updateGameWinner(wildCardGames[3].id, 'Cowboys');
      await updateGameWinner(wildCardGames[4].id, 'Lions');
      await updateGameWinner(wildCardGames[5].id, 'Buccaneers');

      const updatedGames = await getGames(seasonId);
      const divisionalGames = updatedGames.filter(g => g.round === 'divisional');

      // With AFC upsets: #1 Chiefs vs #7 Steelers, #5 Browns vs #6 Dolphins
      const afcDiv1 = divisionalGames[0];
      const afcDiv2 = divisionalGames[1];

      expect(afcDiv1.team_home).toBe('Chiefs');
      expect(afcDiv1.team_away).toBe('Steelers');
      expect(afcDiv1.seed_away).toBe(7);

      expect(afcDiv2.team_home).toBe('Browns');
      expect(afcDiv2.team_away).toBe('Dolphins');
      expect(afcDiv2.seed_home).toBe(5);
      expect(afcDiv2.seed_away).toBe(6);
    });

    it('should not update divisional games if wild card is incomplete', async () => {
      const wildCardGames = games.filter(g => g.round === 'wild_card');

      // Only complete 5 out of 6 wild card games
      await updateGameWinner(wildCardGames[0].id, 'Bills');
      await updateGameWinner(wildCardGames[1].id, 'Ravens');
      await updateGameWinner(wildCardGames[2].id, 'Texans');
      await updateGameWinner(wildCardGames[3].id, 'Cowboys');
      await updateGameWinner(wildCardGames[4].id, 'Lions');
      // wildCardGames[5] not completed

      const updatedGames = await getGames(seasonId);
      const divisionalGames = updatedGames.filter(g => g.round === 'divisional');

      // Divisional games should still be TBD
      divisionalGames.forEach(game => {
        expect(game.team_home).toBe('TBD');
        expect(game.team_away).toBe('TBD');
        expect(game.is_actual_matchup).toBe(0);
      });
    });
  });

  describe('Divisional to Conference Re-seeding', () => {
    it('should update conference matchups when divisional round completes', async () => {
      // Complete Wild Card
      const wildCardGames = games.filter(g => g.round === 'wild_card');
      await updateGameWinner(wildCardGames[0].id, 'Bills');
      await updateGameWinner(wildCardGames[1].id, 'Ravens');
      await updateGameWinner(wildCardGames[2].id, 'Texans');
      await updateGameWinner(wildCardGames[3].id, 'Cowboys');
      await updateGameWinner(wildCardGames[4].id, 'Lions');
      await updateGameWinner(wildCardGames[5].id, 'Buccaneers');

      // Get divisional games (now updated with actual matchups)
      let updatedGames = await getGames(seasonId);
      const divisionalGames = updatedGames.filter(g => g.round === 'divisional');

      // Complete Divisional Round: #1 and #2 seeds win
      await updateGameWinner(divisionalGames[0].id, 'Chiefs');   // AFC: Chiefs beat Texans
      await updateGameWinner(divisionalGames[1].id, 'Bills');    // AFC: Bills beat Ravens
      await updateGameWinner(divisionalGames[2].id, '49ers');    // NFC: 49ers beat Buccaneers
      await updateGameWinner(divisionalGames[3].id, 'Cowboys');  // NFC: Cowboys beat Lions

      // Fetch conference games
      updatedGames = await getGames(seasonId);
      const conferenceGames = updatedGames.filter(g => g.round === 'conference');

      // AFC Conference: #1 Chiefs vs #2 Bills
      expect(conferenceGames[0].team_home).toBe('Chiefs');
      expect(conferenceGames[0].team_away).toBe('Bills');
      expect(conferenceGames[0].seed_home).toBe(1);
      expect(conferenceGames[0].seed_away).toBe(2);
      expect(conferenceGames[0].is_actual_matchup).toBe(1);

      // NFC Conference: #1 49ers vs #2 Cowboys
      expect(conferenceGames[1].team_home).toBe('49ers');
      expect(conferenceGames[1].team_away).toBe('Cowboys');
      expect(conferenceGames[1].seed_home).toBe(1);
      expect(conferenceGames[1].seed_away).toBe(2);
    });

    it('should handle conference games with upsets', async () => {
      // Complete Wild Card with upsets
      const wildCardGames = games.filter(g => g.round === 'wild_card');
      await updateGameWinner(wildCardGames[0].id, 'Steelers');  // #7
      await updateGameWinner(wildCardGames[1].id, 'Ravens');    // #3
      await updateGameWinner(wildCardGames[2].id, 'Texans');    // #4
      await updateGameWinner(wildCardGames[3].id, 'Cowboys');
      await updateGameWinner(wildCardGames[4].id, 'Lions');
      await updateGameWinner(wildCardGames[5].id, 'Buccaneers');

      let updatedGames = await getGames(seasonId);
      const divisionalGames = updatedGames.filter(g => g.round === 'divisional');

      // Divisional upsets: lower seeds win
      await updateGameWinner(divisionalGames[0].id, 'Steelers');  // #7 beats #1 Chiefs
      await updateGameWinner(divisionalGames[1].id, 'Texans');    // #4 beats #3 Ravens
      await updateGameWinner(divisionalGames[2].id, '49ers');
      await updateGameWinner(divisionalGames[3].id, 'Cowboys');

      updatedGames = await getGames(seasonId);
      const conferenceGames = updatedGames.filter(g => g.round === 'conference');

      // AFC Conference: #4 Texans vs #7 Steelers
      expect(conferenceGames[0].team_home).toBe('Texans');
      expect(conferenceGames[0].team_away).toBe('Steelers');
      expect(conferenceGames[0].seed_home).toBe(4);
      expect(conferenceGames[0].seed_away).toBe(7);
    });
  });

  describe('Conference to Super Bowl Re-seeding', () => {
    it('should update Super Bowl when both conference championships complete', async () => {
      // Complete all previous rounds
      const wildCardGames = games.filter(g => g.round === 'wild_card');
      await updateGameWinner(wildCardGames[0].id, 'Bills');
      await updateGameWinner(wildCardGames[1].id, 'Ravens');
      await updateGameWinner(wildCardGames[2].id, 'Texans');
      await updateGameWinner(wildCardGames[3].id, 'Cowboys');
      await updateGameWinner(wildCardGames[4].id, 'Lions');
      await updateGameWinner(wildCardGames[5].id, 'Buccaneers');

      let updatedGames = await getGames(seasonId);
      const divisionalGames = updatedGames.filter(g => g.round === 'divisional');

      await updateGameWinner(divisionalGames[0].id, 'Chiefs');
      await updateGameWinner(divisionalGames[1].id, 'Bills');
      await updateGameWinner(divisionalGames[2].id, '49ers');
      await updateGameWinner(divisionalGames[3].id, 'Lions');

      updatedGames = await getGames(seasonId);
      const conferenceGames = updatedGames.filter(g => g.round === 'conference');

      // AFC: Chiefs win, NFC: 49ers win
      await updateGameWinner(conferenceGames[0].id, 'Chiefs');
      await updateGameWinner(conferenceGames[1].id, '49ers');

      // Check Super Bowl
      updatedGames = await getGames(seasonId);
      const superBowl = updatedGames.find(g => g.round === 'super_bowl');

      expect(superBowl!.team_home).toBe('Chiefs');
      expect(superBowl!.team_away).toBe('49ers');
      expect(superBowl!.is_actual_matchup).toBe(1);
    });

    it('should not update Super Bowl if only one conference championship is complete', async () => {
      // Complete through divisional
      const wildCardGames = games.filter(g => g.round === 'wild_card');
      await updateGameWinner(wildCardGames[0].id, 'Bills');
      await updateGameWinner(wildCardGames[1].id, 'Ravens');
      await updateGameWinner(wildCardGames[2].id, 'Texans');
      await updateGameWinner(wildCardGames[3].id, 'Cowboys');
      await updateGameWinner(wildCardGames[4].id, 'Lions');
      await updateGameWinner(wildCardGames[5].id, 'Buccaneers');

      let updatedGames = await getGames(seasonId);
      const divisionalGames = updatedGames.filter(g => g.round === 'divisional');

      await updateGameWinner(divisionalGames[0].id, 'Chiefs');
      await updateGameWinner(divisionalGames[1].id, 'Bills');
      await updateGameWinner(divisionalGames[2].id, '49ers');
      await updateGameWinner(divisionalGames[3].id, 'Lions');

      updatedGames = await getGames(seasonId);
      const conferenceGames = updatedGames.filter(g => g.round === 'conference');

      // Only complete AFC Championship
      await updateGameWinner(conferenceGames[0].id, 'Chiefs');
      // Don't complete NFC Championship

      updatedGames = await getGames(seasonId);
      const superBowl = updatedGames.find(g => g.round === 'super_bowl');

      // Super Bowl should still be TBD
      expect(superBowl!.team_home).toBe('TBD');
      expect(superBowl!.team_away).toBe('TBD');
      expect(superBowl!.is_actual_matchup).toBe(0);
    });
  });

  describe('Clearing Downstream Winners on Matchup Change', () => {
    it('should clear divisional winners when wild card winner changes', async () => {
      // Complete Wild Card
      const wildCardGames = games.filter(g => g.round === 'wild_card');
      await updateGameWinner(wildCardGames[0].id, 'Bills');
      await updateGameWinner(wildCardGames[1].id, 'Ravens');
      await updateGameWinner(wildCardGames[2].id, 'Texans');
      await updateGameWinner(wildCardGames[3].id, 'Cowboys');
      await updateGameWinner(wildCardGames[4].id, 'Lions');
      await updateGameWinner(wildCardGames[5].id, 'Buccaneers');

      // Complete Divisional
      let updatedGames = await getGames(seasonId);
      const divisionalGames = updatedGames.filter(g => g.round === 'divisional');
      await updateGameWinner(divisionalGames[0].id, 'Chiefs');   // Chiefs beat Texans
      await updateGameWinner(divisionalGames[1].id, 'Bills');
      await updateGameWinner(divisionalGames[2].id, '49ers');
      await updateGameWinner(divisionalGames[3].id, 'Cowboys');

      // Now change a Wild Card result (Browns beat Texans instead)
      await updateGameWinner(wildCardGames[2].id, 'Browns');  // Change from Texans to Browns

      // This changes divisional matchup from Chiefs vs Texans to Chiefs vs Browns
      updatedGames = await getGames(seasonId);
      const updatedDivisionalGames = updatedGames.filter(g => g.round === 'divisional');

      // First divisional game should now be Chiefs vs Browns, with no winner
      expect(updatedDivisionalGames[0].team_away).toBe('Browns');
      expect(updatedDivisionalGames[0].winner).toBeNull();
      expect(updatedDivisionalGames[0].completed).toBe(0);
    });

    it('should clear conference and super bowl winners when divisional result changes', async () => {
      // Set up complete bracket through Super Bowl
      const wildCardGames = games.filter(g => g.round === 'wild_card');
      await updateGameWinner(wildCardGames[0].id, 'Bills');
      await updateGameWinner(wildCardGames[1].id, 'Ravens');
      await updateGameWinner(wildCardGames[2].id, 'Texans');
      await updateGameWinner(wildCardGames[3].id, 'Cowboys');
      await updateGameWinner(wildCardGames[4].id, 'Lions');
      await updateGameWinner(wildCardGames[5].id, 'Buccaneers');

      let updatedGames = await getGames(seasonId);
      let divisionalGames = updatedGames.filter(g => g.round === 'divisional');
      await updateGameWinner(divisionalGames[0].id, 'Chiefs');
      await updateGameWinner(divisionalGames[1].id, 'Bills');
      await updateGameWinner(divisionalGames[2].id, '49ers');
      await updateGameWinner(divisionalGames[3].id, 'Cowboys');

      updatedGames = await getGames(seasonId);
      let conferenceGames = updatedGames.filter(g => g.round === 'conference');
      await updateGameWinner(conferenceGames[0].id, 'Chiefs');
      await updateGameWinner(conferenceGames[1].id, '49ers');

      updatedGames = await getGames(seasonId);
      let superBowl = updatedGames.find(g => g.round === 'super_bowl');
      await updateGameWinner(superBowl!.id, 'Chiefs');

      // Now change a divisional result: Ravens beat Bills instead
      updatedGames = await getGames(seasonId);
      divisionalGames = updatedGames.filter(g => g.round === 'divisional');
      await updateGameWinner(divisionalGames[1].id, 'Ravens');  // Change from Bills to Ravens

      // This changes AFC Conference from Chiefs vs Bills to Chiefs vs Ravens
      updatedGames = await getGames(seasonId);
      conferenceGames = updatedGames.filter(g => g.round === 'conference');

      // AFC Conference should be Chiefs vs Ravens with no winner
      expect(conferenceGames[0].team_away).toBe('Ravens');
      expect(conferenceGames[0].winner).toBeNull();
      expect(conferenceGames[0].completed).toBe(0);

      // Super Bowl should still have its matchup but the AFC representative changed
      // This test verifies the cascading clear works
      superBowl = updatedGames.find(g => g.round === 'super_bowl');
      expect(superBowl!.winner).toBeNull();
      expect(superBowl!.completed).toBe(0);
    });

    it('should preserve winners if matchup does not change', async () => {
      // Complete Wild Card
      const wildCardGames = games.filter(g => g.round === 'wild_card');
      await updateGameWinner(wildCardGames[0].id, 'Bills');
      await updateGameWinner(wildCardGames[1].id, 'Ravens');
      await updateGameWinner(wildCardGames[2].id, 'Texans');
      await updateGameWinner(wildCardGames[3].id, 'Cowboys');
      await updateGameWinner(wildCardGames[4].id, 'Lions');
      await updateGameWinner(wildCardGames[5].id, 'Buccaneers');

      // Complete Divisional
      let updatedGames = await getGames(seasonId);
      const divisionalGames = updatedGames.filter(g => g.round === 'divisional');
      await updateGameWinner(divisionalGames[0].id, 'Chiefs');
      await updateGameWinner(divisionalGames[1].id, 'Bills');

      // Re-set the same wild card winner (should not clear divisional winner)
      await updateGameWinner(wildCardGames[0].id, 'Bills');

      updatedGames = await getGames(seasonId);
      const unchangedDivisional = updatedGames.filter(g => g.round === 'divisional');

      // Divisional winner should still be set
      expect(unchangedDivisional[1].winner).toBe('Bills');
      expect(unchangedDivisional[1].completed).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle partial round completion gracefully', async () => {
      const wildCardGames = games.filter(g => g.round === 'wild_card');

      // Complete only AFC wild card games
      await updateGameWinner(wildCardGames[0].id, 'Bills');
      await updateGameWinner(wildCardGames[1].id, 'Ravens');
      await updateGameWinner(wildCardGames[2].id, 'Texans');

      const updatedGames = await getGames(seasonId);
      const divisionalGames = updatedGames.filter(g => g.round === 'divisional');

      // Divisional should still be all TBD (round not complete)
      divisionalGames.forEach(game => {
        expect(game.team_home).toBe('TBD');
        expect(game.is_actual_matchup).toBe(0);
      });
    });

    it('should maintain seed information through re-seeding', async () => {
      const wildCardGames = games.filter(g => g.round === 'wild_card');
      await updateGameWinner(wildCardGames[0].id, 'Bills');
      await updateGameWinner(wildCardGames[1].id, 'Ravens');
      await updateGameWinner(wildCardGames[2].id, 'Texans');
      await updateGameWinner(wildCardGames[3].id, 'Cowboys');
      await updateGameWinner(wildCardGames[4].id, 'Lions');
      await updateGameWinner(wildCardGames[5].id, 'Buccaneers');

      const updatedGames = await getGames(seasonId);
      const divisionalGames = updatedGames.filter(g => g.round === 'divisional');

      // All divisional games should have seed information
      divisionalGames.forEach(game => {
        expect(game.seed_home).not.toBeNull();
        expect(game.seed_away).not.toBeNull();
        expect(game.seed_home).toBeLessThan(game.seed_away!); // Higher seed (lower number) is home
      });
    });
  });
});
