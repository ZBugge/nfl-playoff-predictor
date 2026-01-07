import fetch from 'node-fetch';
import { getGamesBySeason, updateGameWinner } from './season.js';

interface ESPNEvent {
  id: string;
  name: string;
  shortName: string;
  date: string;
  competitions: Array<{
    competitors: Array<{
      team: {
        abbreviation: string;
        displayName: string;
      };
      homeAway: 'home' | 'away';
      winner?: boolean;
    }>;
    status: {
      type: {
        completed: boolean;
      };
    };
  }>;
}

interface ESPNScoreboard {
  events: ESPNEvent[];
}

export async function fetchNFLPlayoffScores(): Promise<ESPNScoreboard | null> {
  try {
    const response = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
    );

    if (!response.ok) {
      console.error('Failed to fetch ESPN scores:', response.statusText);
      return null;
    }

    const data = await response.json() as ESPNScoreboard;
    return data;
  } catch (error) {
    console.error('Error fetching ESPN scores:', error);
    return null;
  }
}

export async function updateSeasonScoresFromESPN(seasonId: number): Promise<number> {
  const games = await getGamesBySeason(seasonId);
  const scoreboard = await fetchNFLPlayoffScores();

  if (!scoreboard) {
    return 0;
  }

  let updatedCount = 0;

  for (const game of games) {
    if (game.completed || !game.espn_event_id) {
      continue;
    }

    const espnEvent = scoreboard.events.find((e) => e.id === game.espn_event_id);

    if (!espnEvent) {
      continue;
    }

    const competition = espnEvent.competitions[0];
    const isCompleted = competition.status.type.completed;

    if (!isCompleted) {
      continue;
    }

    const winner = competition.competitors.find((c) => c.winner);

    if (winner) {
      const winnerTeam = winner.team.abbreviation;
      await updateGameWinner(game.id, winnerTeam);
      updatedCount++;
      console.log(`Updated game ${game.id}: ${winnerTeam} wins`);
    }
  }

  return updatedCount;
}

export async function searchPlayoffGames(year: number = new Date().getFullYear()): Promise<ESPNEvent[]> {
  try {
    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${year}0101-${year}0228&seasontype=3`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as ESPNScoreboard;
    return data.events || [];
  } catch (error) {
    console.error('Error searching playoff games:', error);
    return [];
  }
}
