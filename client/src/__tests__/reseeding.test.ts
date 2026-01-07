import { describe, it, expect } from 'vitest'
import type { Game } from '../api/api'

// Re-seeding logic extracted for testing
function calculateDivisionalMatchup(
  wildCardGames: Game[],
  predictions: Record<number, { winner: string; opponent: string }>,
  seeds: Array<{ conference: string; seed: number; team_abbr: string }>,
  conference: 'AFC' | 'NFC',
  gameNumber: 1 | 2
): { home: string; away: string } {
  // Get Wild Card games for this conference (games 1-3 are AFC, 4-6 are NFC)
  const confWildCardGames = conference === 'AFC'
    ? wildCardGames.slice(0, 3)
    : wildCardGames.slice(3, 6)

  // Get winners and their seeds from predictions
  const winners = confWildCardGames
    .map(wcGame => {
      const prediction = predictions[wcGame.id]
      if (!prediction?.winner) return null

      // Determine seed of winner
      const winnerSeed = wcGame.team_home === prediction.winner
        ? wcGame.seed_home
        : wcGame.seed_away

      return { team: prediction.winner, seed: winnerSeed }
    })
    .filter(w => w !== null && w.seed !== null) as Array<{ team: string; seed: number }>

  // Add bye team (seed #1 only) from the seeds data
  const confSeeds = seeds.filter(s => s.conference === conference)
  const seed1 = confSeeds.find(s => s.seed === 1)

  const byeTeams: Array<{ team: string; seed: number }> = []
  if (seed1) byeTeams.push({ team: seed1.team_abbr, seed: 1 })

  // Sort all advancing teams by seed (lowest seed number = best team)
  const allTeams = [...byeTeams, ...winners].sort((a, b) => a.seed - b.seed)

  if (allTeams.length < 4) {
    // Not enough predictions yet (need 3 Wild Card winners + 1 bye team = 4 total)
    return { home: 'TBD', away: 'TBD' }
  }

  // Re-seed: #1 vs lowest remaining seed, then second-best vs second-worst
  if (gameNumber === 1) {
    // First divisional game for this conference
    return {
      home: allTeams[0]?.team || 'TBD',
      away: allTeams[allTeams.length - 1]?.team || 'TBD'
    }
  } else {
    // Second divisional game for this conference
    return {
      home: allTeams[1]?.team || 'TBD',
      away: allTeams[allTeams.length - 2]?.team || 'TBD'
    }
  }
}

describe('NFL Playoff Re-Seeding Logic', () => {
  // Setup mock data
  const seeds = [
    { conference: 'AFC', seed: 1, team_abbr: 'KC' },
    { conference: 'AFC', seed: 2, team_abbr: 'BUF' },
    { conference: 'AFC', seed: 3, team_abbr: 'BAL' },
    { conference: 'AFC', seed: 4, team_abbr: 'HOU' },
    { conference: 'AFC', seed: 5, team_abbr: 'CLE' },
    { conference: 'AFC', seed: 6, team_abbr: 'MIA' },
    { conference: 'AFC', seed: 7, team_abbr: 'PIT' },
    { conference: 'NFC', seed: 1, team_abbr: 'SF' },
    { conference: 'NFC', seed: 2, team_abbr: 'PHI' },
    { conference: 'NFC', seed: 3, team_abbr: 'DET' },
    { conference: 'NFC', seed: 4, team_abbr: 'TB' },
    { conference: 'NFC', seed: 5, team_abbr: 'DAL' },
    { conference: 'NFC', seed: 6, team_abbr: 'LAR' },
    { conference: 'NFC', seed: 7, team_abbr: 'GB' },
  ]

  const afcWildCardGames: Game[] = [
    { id: 1, season_id: 1, round: 'wild_card', game_number: 1, team_home: 'BUF', team_away: 'PIT', seed_home: 2, seed_away: 7, winner: null, espn_event_id: null, completed: false, is_actual_matchup: true },
    { id: 2, season_id: 1, round: 'wild_card', game_number: 2, team_home: 'BAL', team_away: 'MIA', seed_home: 3, seed_away: 6, winner: null, espn_event_id: null, completed: false, is_actual_matchup: true },
    { id: 3, season_id: 1, round: 'wild_card', game_number: 3, team_home: 'HOU', team_away: 'CLE', seed_home: 4, seed_away: 5, winner: null, espn_event_id: null, completed: false, is_actual_matchup: true },
  ]

  const nfcWildCardGames: Game[] = [
    { id: 4, season_id: 1, round: 'wild_card', game_number: 4, team_home: 'PHI', team_away: 'GB', seed_home: 2, seed_away: 7, winner: null, espn_event_id: null, completed: false, is_actual_matchup: true },
    { id: 5, season_id: 1, round: 'wild_card', game_number: 5, team_home: 'DET', team_away: 'LAR', seed_home: 3, seed_away: 6, winner: null, espn_event_id: null, completed: false, is_actual_matchup: true },
    { id: 6, season_id: 1, round: 'wild_card', game_number: 6, team_home: 'TB', team_away: 'DAL', seed_home: 4, seed_away: 5, winner: null, espn_event_id: null, completed: false, is_actual_matchup: true },
  ]

  const allWildCardGames = [...afcWildCardGames, ...nfcWildCardGames]

  describe('Scenario 1: All Chalk (Higher Seeds Win)', () => {
    it('should create standard bracket when all higher seeds win', () => {
      const predictions = {
        1: { winner: 'BUF', opponent: 'PIT' },  // #2 beats #7
        2: { winner: 'BAL', opponent: 'MIA' },  // #3 beats #6
        3: { winner: 'HOU', opponent: 'CLE' },  // #4 beats #5
      }

      // Advancing: #1 KC (bye), #2 BUF, #3 BAL, #4 HOU
      // Sorted: #1, #2, #3, #4
      // Divisional Game 1: #1 KC vs #4 HOU (best vs worst)
      const div1 = calculateDivisionalMatchup(allWildCardGames, predictions, seeds, 'AFC', 1)
      expect(div1.home).toBe('KC')
      expect(div1.away).toBe('HOU')

      // Divisional Game 2: #2 BUF vs #3 BAL (second-best vs second-worst)
      const div2 = calculateDivisionalMatchup(allWildCardGames, predictions, seeds, 'AFC', 2)
      expect(div2.home).toBe('BUF')
      expect(div2.away).toBe('BAL')
    })
  })

  describe('Scenario 2: Single Upset (#7 beats #2)', () => {
    it('should match #1 vs #7 when #7 upsets #2', () => {
      const predictions = {
        1: { winner: 'PIT', opponent: 'BUF' },  // #7 beats #2 (UPSET!)
        2: { winner: 'BAL', opponent: 'MIA' },  // #3 beats #6
        3: { winner: 'HOU', opponent: 'CLE' },  // #4 beats #5
      }

      // Advancing: #1 KC (bye), #7 PIT, #3 BAL, #4 HOU
      // Sorted by seed: #1, #3, #4, #7
      // Divisional Game 1: #1 KC vs #7 PIT (best vs worst)
      const div1 = calculateDivisionalMatchup(allWildCardGames, predictions, seeds, 'AFC', 1)
      expect(div1.home).toBe('KC')
      expect(div1.away).toBe('PIT')

      // Divisional Game 2: #3 BAL vs #4 HOU (second-best vs second-worst)
      const div2 = calculateDivisionalMatchup(allWildCardGames, predictions, seeds, 'AFC', 2)
      expect(div2.home).toBe('BAL')
      expect(div2.away).toBe('HOU')
    })
  })

  describe('Scenario 3: Multiple Upsets', () => {
    it('should handle multiple upsets correctly', () => {
      const predictions = {
        1: { winner: 'PIT', opponent: 'BUF' },  // #7 beats #2
        2: { winner: 'MIA', opponent: 'BAL' },  // #6 beats #3
        3: { winner: 'CLE', opponent: 'HOU' },  // #5 beats #4
      }

      // Advancing: #1 KC (bye), #7 PIT, #6 MIA, #5 CLE
      // Sorted: #1, #5, #6, #7
      // Divisional Game 1: #1 KC vs #7 PIT (best vs worst)
      const div1 = calculateDivisionalMatchup(allWildCardGames, predictions, seeds, 'AFC', 1)
      expect(div1.home).toBe('KC')
      expect(div1.away).toBe('PIT')

      // Divisional Game 2: #5 CLE vs #6 MIA (second-best vs second-worst)
      const div2 = calculateDivisionalMatchup(allWildCardGames, predictions, seeds, 'AFC', 2)
      expect(div2.home).toBe('CLE')
      expect(div2.away).toBe('MIA')
    })
  })

  describe('Scenario 4: Incomplete Predictions', () => {
    it('should show TBD when not all predictions are made', () => {
      const predictions = {
        1: { winner: 'BUF', opponent: 'PIT' },  // #2 beats #7
        // Games 2 and 3 not predicted yet
      }

      const result = calculateDivisionalMatchup(allWildCardGames, predictions, seeds, 'AFC', 1)
      expect(result.home).toBe('TBD')
      expect(result.away).toBe('TBD')
    })

    it('should work with partial predictions when at least 3 Wild Card winners selected', () => {
      const predictions = {
        1: { winner: 'BUF', opponent: 'PIT' },  // #2 beats #7
        2: { winner: 'BAL', opponent: 'MIA' },  // #3 beats #6
        3: { winner: 'HOU', opponent: 'CLE' },  // #4 beats #5
      }

      // With bye: #1 KC (bye), plus Wild Card winners: #2 BUF, #3 BAL, #4 HOU
      // Total: 4 teams advancing = exactly enough
      const result = calculateDivisionalMatchup(allWildCardGames, predictions, seeds, 'AFC', 1)
      expect(result.home).toBe('KC')
      expect(result.away).toBe('HOU')
    })
  })

  describe('Scenario 5: NFC Conference', () => {
    it('should correctly handle NFC re-seeding', () => {
      const predictions = {
        4: { winner: 'GB', opponent: 'PHI' },   // #7 beats #2 (UPSET!)
        5: { winner: 'DET', opponent: 'LAR' },  // #3 beats #6
        6: { winner: 'TB', opponent: 'DAL' },   // #4 beats #5
      }

      // Advancing: #1 SF (bye), #7 GB, #3 DET, #4 TB
      // Sorted: #1, #3, #4, #7
      // Divisional Game 3 (NFC Game 1): #1 SF vs #7 GB
      const div3 = calculateDivisionalMatchup(allWildCardGames, predictions, seeds, 'NFC', 1)
      expect(div3.home).toBe('SF')
      expect(div3.away).toBe('GB')

      // Divisional Game 4 (NFC Game 2): #3 DET vs #4 TB (second-best vs second-worst)
      const div4 = calculateDivisionalMatchup(allWildCardGames, predictions, seeds, 'NFC', 2)
      expect(div4.home).toBe('DET')
      expect(div4.away).toBe('TB')
    })
  })

  describe('Scenario 6: Edge Case - All Lower Seeds Win', () => {
    it('should handle all lower seeds winning', () => {
      const predictions = {
        1: { winner: 'PIT', opponent: 'BUF' },  // #7 beats #2
        2: { winner: 'MIA', opponent: 'BAL' },  // #6 beats #3
        3: { winner: 'CLE', opponent: 'HOU' },  // #5 beats #4
      }

      // Advancing: #1 KC (bye), #5 CLE, #6 MIA, #7 PIT
      // Sorted: #1, #5, #6, #7
      // Divisional Game 1: #1 KC vs #7 PIT (best vs worst)
      const div1 = calculateDivisionalMatchup(allWildCardGames, predictions, seeds, 'AFC', 1)
      expect(div1.home).toBe('KC')
      expect(div1.away).toBe('PIT')

      // Divisional Game 2: #5 CLE vs #6 MIA (second-best vs second-worst)
      const div2 = calculateDivisionalMatchup(allWildCardGames, predictions, seeds, 'AFC', 2)
      expect(div2.home).toBe('CLE')
      expect(div2.away).toBe('MIA')
    })
  })
})

describe('Scoring Logic with Matchup Bonuses', () => {
  // Test the scoring calculations
  const WEIGHTED_POINTS = {
    wild_card: 1,
    divisional: 2,
    conference: 3,
    super_bowl: 5,
  }

  function calculatePoints(
    game: { round: string; team_home: string; team_away: string; winner: string },
    prediction: { predicted_winner: string; predicted_opponent?: string }
  ) {
    const predictedCorrectWinner = game.winner === prediction.predicted_winner
    if (!predictedCorrectWinner) {
      return { simple: 0, weighted: 0, isCorrect: false }
    }

    // Check if the opponent matches (matchup was correct)
    const matchupMatches = !prediction.predicted_opponent ||
      game.team_home === prediction.predicted_opponent ||
      game.team_away === prediction.predicted_opponent

    const baseWeightedPoints = WEIGHTED_POINTS[game.round as keyof typeof WEIGHTED_POINTS]

    if (matchupMatches) {
      // Full points - correct matchup
      return {
        simple: 1,
        weighted: baseWeightedPoints,
        isCorrect: true,
      }
    } else {
      // Penalty - 75% of base points for wrong matchup
      return {
        simple: 0.75,
        weighted: baseWeightedPoints * 0.75,
        isCorrect: true,
      }
    }
  }

  it('should award 1x points for correct winner in correct matchup', () => {
    const game = {
      round: 'divisional',
      team_home: 'KC',
      team_away: 'HOU',
      winner: 'KC'
    }

    const prediction = {
      predicted_winner: 'KC',
      predicted_opponent: 'HOU'
    }

    const points = calculatePoints(game, prediction)
    expect(points.simple).toBe(1)
    expect(points.weighted).toBe(2) // 2 * 1 = 2
    expect(points.isCorrect).toBe(true)
  })

  it('should award 0.75x points for correct winner in wrong matchup', () => {
    const game = {
      round: 'divisional',
      team_home: 'KC',
      team_away: 'PIT',  // User predicted KC vs HOU, but actual matchup is KC vs PIT
      winner: 'KC'
    }

    const prediction = {
      predicted_winner: 'KC',
      predicted_opponent: 'HOU'  // Wrong opponent!
    }

    const points = calculatePoints(game, prediction)
    expect(points.simple).toBe(0.75)
    expect(points.weighted).toBe(1.5) // 2 * 0.75 = 1.5
    expect(points.isCorrect).toBe(true)
  })

  it('should award 0 points for wrong winner', () => {
    const game = {
      round: 'divisional',
      team_home: 'KC',
      team_away: 'HOU',
      winner: 'HOU'
    }

    const prediction = {
      predicted_winner: 'KC',
      predicted_opponent: 'HOU'
    }

    const points = calculatePoints(game, prediction)
    expect(points.simple).toBe(0)
    expect(points.weighted).toBe(0)
    expect(points.isCorrect).toBe(false)
  })

  it('should work correctly for Super Bowl scoring', () => {
    const game = {
      round: 'super_bowl',
      team_home: 'KC',
      team_away: 'SF',
      winner: 'KC'
    }

    const prediction = {
      predicted_winner: 'KC',
      predicted_opponent: 'SF'
    }

    const points = calculatePoints(game, prediction)
    expect(points.simple).toBe(1)
    expect(points.weighted).toBe(5) // 5 * 1 = 5
    expect(points.isCorrect).toBe(true)
  })
})

describe('Conference Championship Re-Seeding', () => {
  // Conference Championship just takes the two Divisional winners
  function calculateConferenceMatchup(
    divisionalGames: Game[],
    predictions: Record<number, { winner: string; opponent: string }>,
    conference: 'AFC' | 'NFC'
  ): { home: string; away: string } {
    // Get Divisional games for this conference
    const confDivGames = conference === 'AFC'
      ? divisionalGames.filter(g => g.game_number <= 2)
      : divisionalGames.filter(g => g.game_number > 2)

    // Get winners from predictions
    const winners = confDivGames.map(g => predictions[g.id]?.winner).filter(w => w)

    if (winners.length < 2) {
      return { home: 'TBD', away: 'TBD' }
    }

    // Simple: first winner vs second winner (no re-seeding for Conference)
    return { home: winners[0], away: winners[1] }
  }

  const divisionalGames: Game[] = [
    { id: 7, season_id: 1, round: 'divisional', game_number: 1, team_home: 'KC', team_away: 'HOU', seed_home: null, seed_away: null, winner: null, espn_event_id: null, completed: false, is_actual_matchup: false },
    { id: 8, season_id: 1, round: 'divisional', game_number: 2, team_home: 'BUF', team_away: 'BAL', seed_home: null, seed_away: null, winner: null, espn_event_id: null, completed: false, is_actual_matchup: false },
    { id: 9, season_id: 1, round: 'divisional', game_number: 3, team_home: 'SF', team_away: 'TB', seed_home: null, seed_away: null, winner: null, espn_event_id: null, completed: false, is_actual_matchup: false },
    { id: 10, season_id: 1, round: 'divisional', game_number: 4, team_home: 'PHI', team_away: 'DET', seed_home: null, seed_away: null, winner: null, espn_event_id: null, completed: false, is_actual_matchup: false },
  ]

  it('should match AFC Divisional winners', () => {
    const predictions = {
      7: { winner: 'KC', opponent: 'HOU' },
      8: { winner: 'BUF', opponent: 'BAL' },
    }

    const matchup = calculateConferenceMatchup(divisionalGames, predictions, 'AFC')

    expect(matchup.home).toBe('KC')
    expect(matchup.away).toBe('BUF')
  })

  it('should match NFC Divisional winners', () => {
    const predictions = {
      9: { winner: 'SF', opponent: 'TB' },
      10: { winner: 'DET', opponent: 'PHI' },
    }

    const matchup = calculateConferenceMatchup(divisionalGames, predictions, 'NFC')

    expect(matchup.home).toBe('SF')
    expect(matchup.away).toBe('DET')
  })

  it('should show TBD when divisional predictions incomplete', () => {
    const predictions = {
      7: { winner: 'KC', opponent: 'HOU' },
      // Missing prediction for game 8
    }

    const matchup = calculateConferenceMatchup(divisionalGames, predictions, 'AFC')

    expect(matchup.home).toBe('TBD')
    expect(matchup.away).toBe('TBD')
  })

  it('should not mix conferences', () => {
    const predictions = {
      7: { winner: 'KC', opponent: 'HOU' },
      8: { winner: 'BUF', opponent: 'BAL' },
      9: { winner: 'SF', opponent: 'TB' },
      10: { winner: 'DET', opponent: 'PHI' },
    }

    const afcMatchup = calculateConferenceMatchup(divisionalGames, predictions, 'AFC')
    const nfcMatchup = calculateConferenceMatchup(divisionalGames, predictions, 'NFC')

    // AFC should only have AFC teams
    expect(['KC', 'BUF', 'BAL', 'HOU']).toContain(afcMatchup.home)
    expect(['KC', 'BUF', 'BAL', 'HOU']).toContain(afcMatchup.away)

    // NFC should only have NFC teams
    expect(['SF', 'DET', 'PHI', 'TB']).toContain(nfcMatchup.home)
    expect(['SF', 'DET', 'PHI', 'TB']).toContain(nfcMatchup.away)
  })
})

describe('Super Bowl Matchup', () => {
  function calculateSuperBowlMatchup(
    conferenceGames: Game[],
    predictions: Record<number, { winner: string; opponent: string }>
  ): { home: string; away: string } {
    // Get AFC and NFC Championship winners
    const afcChampGame = conferenceGames.find(g => g.game_number === 1)
    const nfcChampGame = conferenceGames.find(g => g.game_number === 2)

    const afcChamp = afcChampGame ? predictions[afcChampGame.id]?.winner : null
    const nfcChamp = nfcChampGame ? predictions[nfcChampGame.id]?.winner : null

    if (!afcChamp || !nfcChamp) {
      return { home: 'TBD', away: 'TBD' }
    }

    return { home: afcChamp, away: nfcChamp }
  }

  const conferenceGames: Game[] = [
    { id: 11, season_id: 1, round: 'conference', game_number: 1, team_home: 'KC', team_away: 'BUF', seed_home: null, seed_away: null, winner: null, espn_event_id: null, completed: false, is_actual_matchup: false },
    { id: 12, season_id: 1, round: 'conference', game_number: 2, team_home: 'SF', team_away: 'DET', seed_home: null, seed_away: null, winner: null, espn_event_id: null, completed: false, is_actual_matchup: false },
  ]

  it('should match AFC champion vs NFC champion', () => {
    const predictions = {
      11: { winner: 'KC', opponent: 'BUF' },
      12: { winner: 'SF', opponent: 'DET' },
    }

    const matchup = calculateSuperBowlMatchup(conferenceGames, predictions)

    expect(matchup.home).toBe('KC')
    expect(matchup.away).toBe('SF')
  })

  it('should show TBD when conference predictions incomplete', () => {
    const predictions = {
      11: { winner: 'KC', opponent: 'BUF' },
      // Missing NFC prediction
    }

    const matchup = calculateSuperBowlMatchup(conferenceGames, predictions)

    expect(matchup.home).toBe('TBD')
    expect(matchup.away).toBe('TBD')
  })

  it('should handle upsets in conference championships', () => {
    const predictions = {
      11: { winner: 'BUF', opponent: 'KC' },  // BUF upsets KC
      12: { winner: 'DET', opponent: 'SF' },  // DET upsets SF
    }

    const matchup = calculateSuperBowlMatchup(conferenceGames, predictions)

    expect(matchup.home).toBe('BUF')
    expect(matchup.away).toBe('DET')
  })
})
