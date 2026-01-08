import { type Game, type Prediction, type Participant } from '../db/schema.js';
import { getParticipantById, getPredictionsByParticipant } from './lobby.js';
import { getGamesBySeason } from './season.js';

const WEIGHTED_POINTS: Record<string, number> = {
  wild_card: 1,
  divisional: 2,
  conference: 3,
  super_bowl: 5,
};

export interface BracketGame {
  id: number;
  round: string;
  gameNumber: number;
  teamHome: string;
  teamAway: string;
  seedHome: number | null;
  seedAway: number | null;
  winner: string | null;
  completed: boolean;
  prediction: {
    predictedWinner: string;
    predictedOpponent: string | null;
  } | null;
  isCorrect: boolean | null; // null if game not completed
}

export interface BracketData {
  participant: {
    id: number;
    name: string;
  };
  stats: {
    simpleScore: number;
    weightedScore: number;
    correctPicks: number;
    totalPicks: number;
  };
  games: BracketGame[];
}

export async function getParticipantBracket(
  participantId: number,
  seasonId: number
): Promise<BracketData | null> {
  const participant = await getParticipantById(participantId);
  if (!participant) {
    return null;
  }

  const predictions = await getPredictionsByParticipant(participantId);
  const games = await getGamesBySeason(seasonId);

  // Build prediction lookup map
  const predictionMap = new Map<number, Prediction>();
  for (const pred of predictions) {
    predictionMap.set(pred.game_id, pred);
  }

  // Build set of eliminated teams (losers of completed games)
  const eliminatedTeams = new Set<string>();
  for (const game of games) {
    if (game.completed && game.winner) {
      // The loser is the team that isn't the winner
      if (game.team_home && game.team_home !== game.winner) {
        eliminatedTeams.add(game.team_home);
      }
      if (game.team_away && game.team_away !== game.winner) {
        eliminatedTeams.add(game.team_away);
      }
    }
  }

  // Calculate stats and build bracket games
  let simpleScore = 0;
  let weightedScore = 0;
  let correctPicks = 0;
  let totalPicks = 0;

  const bracketGames: BracketGame[] = games.map((game) => {
    const prediction = predictionMap.get(game.id);
    let isCorrect: boolean | null = null;

    if (prediction) {
      totalPicks++;

      if (game.completed && game.winner) {
        // Game is completed - check if prediction was correct
        isCorrect = game.winner === prediction.predicted_winner;
        if (isCorrect) {
          correctPicks++;
          simpleScore += 1;
          weightedScore += WEIGHTED_POINTS[game.round] || 0;
        }
      } else {
        // Game not completed - check if predicted winner is already eliminated
        if (eliminatedTeams.has(prediction.predicted_winner)) {
          isCorrect = false; // Predicted winner can't win anymore
        }
      }
    }

    return {
      id: game.id,
      round: game.round,
      gameNumber: game.game_number,
      teamHome: game.team_home,
      teamAway: game.team_away,
      seedHome: game.seed_home,
      seedAway: game.seed_away,
      winner: game.winner,
      completed: game.completed,
      prediction: prediction
        ? {
            predictedWinner: prediction.predicted_winner,
            predictedOpponent: prediction.predicted_opponent,
          }
        : null,
      isCorrect,
    };
  });

  return {
    participant: {
      id: participant.id,
      name: participant.name,
    },
    stats: {
      simpleScore,
      weightedScore,
      correctPicks,
      totalPicks,
    },
    games: bracketGames,
  };
}
