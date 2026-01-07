import { type Lobby, type Game, type Prediction } from '../db/schema.js';
import { getPredictionsByLobby, getParticipantsByLobby } from './lobby.js';
import { getGamesBySeason } from './season.js';

interface LeaderboardEntry {
  participantId: number;
  name: string;
  simpleScore: number;
  weightedScore: number;
  correctPicks: number;
  totalPicks: number;
}

const WEIGHTED_POINTS = {
  wild_card: 1,
  divisional: 2,
  conference: 3,
  super_bowl: 5,
};

function calculatePoints(
  game: Game,
  prediction: Prediction,
  scoringType: Lobby['scoring_type']
): { simple: number; weighted: number; isCorrect: boolean } {
  if (!game.completed || !game.winner) {
    return { simple: 0, weighted: 0, isCorrect: false };
  }

  const predictedCorrectWinner = game.winner === prediction.predicted_winner;
  if (!predictedCorrectWinner) {
    return { simple: 0, weighted: 0, isCorrect: false };
  }

  // Correct winner prediction = full points (no matchup penalty)
  const baseWeightedPoints = WEIGHTED_POINTS[game.round];
  return {
    simple: 1,
    weighted: baseWeightedPoints,
    isCorrect: true,
  };
}

export async function calculateLeaderboard(lobbyId: string, seasonId: number, scoringType: Lobby['scoring_type']): Promise<LeaderboardEntry[]> {
  const games = await getGamesBySeason(seasonId);
  const predictions = await getPredictionsByLobby(lobbyId);
  const participants = await getParticipantsByLobby(lobbyId);

  const leaderboard: Map<number, LeaderboardEntry> = new Map();

  for (const participant of participants) {
    leaderboard.set(participant.id, {
      participantId: participant.id,
      name: participant.name,
      simpleScore: 0,
      weightedScore: 0,
      correctPicks: 0,
      totalPicks: 0,
    });
  }

  for (const prediction of predictions) {
    const game = games.find((g) => g.id === prediction.game_id);
    if (!game) continue;

    const entry = leaderboard.get(prediction.participant_id)!;
    entry.totalPicks++;

    const points = calculatePoints(game, prediction, scoringType);

    if (points.isCorrect) {
      entry.correctPicks++;
      entry.simpleScore += points.simple;
      entry.weightedScore += points.weighted;
    }
  }

  const entries = Array.from(leaderboard.values());

  if (scoringType === 'simple') {
    return entries.sort((a, b) => b.simpleScore - a.simpleScore);
  } else if (scoringType === 'weighted') {
    return entries.sort((a, b) => b.weightedScore - a.weightedScore);
  } else {
    return entries.sort((a, b) => b.simpleScore - a.simpleScore);
  }
}

export async function getLeaderboardStats(seasonId: number) {
  const games = await getGamesBySeason(seasonId);
  const completedGames = games.filter((g) => g.completed).length;
  const totalGames = games.length;

  return {
    completedGames,
    totalGames,
    progress: totalGames > 0 ? (completedGames / totalGames) * 100 : 0,
  };
}
