const API_URL = '/api';

interface Admin {
  id: number;
  username: string;
  is_super_admin: boolean;
}

interface Season {
  id: number;
  name: string;
  year: number;
  sport: string;
  status: 'active' | 'archived';
  created_at: string;
}

interface Lobby {
  id: string;
  admin_id: number;
  season_id: number;
  name: string;
  scoring_type: 'simple' | 'weighted' | 'bracket' | 'both';
  status: 'open' | 'in_progress' | 'completed';
  created_at: string;
}

interface Game {
  id: number;
  season_id: number;
  round: 'wild_card' | 'divisional' | 'conference' | 'super_bowl';
  game_number: number;
  team_home: string;
  team_away: string;
  seed_home: number | null;
  seed_away: number | null;
  winner: string | null;
  espn_event_id: string | null;
  completed: boolean;
  is_actual_matchup: boolean;
}

interface Participant {
  id: number;
  lobby_id: string;
  name: string;
  submitted_at: string;
}

interface LeaderboardEntry {
  participantId: number;
  name: string;
  simpleScore: number;
  weightedScore: number;
  correctPicks: number;
  totalPicks: number;
}

export const api = {
  auth: {
    register: async (username: string, password: string): Promise<Admin> => {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Registration failed');
      }
      return res.json();
    },

    login: async (username: string, password: string): Promise<Admin> => {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Login failed');
      }
      return res.json();
    },

    logout: async (): Promise<void> => {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    },

    me: async (): Promise<Admin> => {
      const res = await fetch(`${API_URL}/auth/me`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    },
  },

  lobby: {
    create: async (name: string, seasonId: number, scoringType: Lobby['scoring_type']): Promise<Lobby> => {
      const res = await fetch(`${API_URL}/lobby/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, seasonId, scoringType }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create lobby');
      }
      return res.json();
    },

    getMyLobbies: async (): Promise<Lobby[]> => {
      const res = await fetch(`${API_URL}/lobby/my-lobbies`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to get lobbies');
      return res.json();
    },

    getById: async (id: string): Promise<Lobby> => {
      const res = await fetch(`${API_URL}/lobby/${id}`);
      if (!res.ok) throw new Error('Lobby not found');
      return res.json();
    },

    getGames: async (lobbyId: string): Promise<Game[]> => {
      const res = await fetch(`${API_URL}/lobby/${lobbyId}/games`);
      if (!res.ok) throw new Error('Failed to get games');
      return res.json();
    },

    deleteParticipant: async (lobbyId: string, participantId: number): Promise<void> => {
      const res = await fetch(`${API_URL}/lobby/${lobbyId}/participants/${participantId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete participant');
      }
    },

    bulkDeleteParticipants: async (lobbyId: string, participantIds: number[]): Promise<{ deletedCount: number }> => {
      const res = await fetch(`${API_URL}/lobby/${lobbyId}/participants/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ participantIds }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete participants');
      }
      return res.json();
    },

    delete: async (lobbyId: string): Promise<void> => {
      const res = await fetch(`${API_URL}/lobby/${lobbyId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete lobby');
      }
    },
  },

  season: {
    getActive: async (): Promise<Season[]> => {
      const res = await fetch(`${API_URL}/season/active`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to get active seasons');
      return res.json();
    },

    getAll: async (): Promise<Season[]> => {
      const res = await fetch(`${API_URL}/season/all`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to get all seasons');
      return res.json();
    },

    create: async (name: string, year: number, sport: string = 'NFL'): Promise<Season> => {
      const res = await fetch(`${API_URL}/season/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, year, sport }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create season');
      }
      return res.json();
    },

    getGames: async (seasonId: number): Promise<Game[]> => {
      const res = await fetch(`${API_URL}/season/${seasonId}/games`);
      if (!res.ok) throw new Error('Failed to get games');
      return res.json();
    },

    addGame: async (
      seasonId: number,
      round: Game['round'],
      teamHome: string,
      teamAway: string,
      espnEventId?: string
    ): Promise<Game> => {
      const res = await fetch(`${API_URL}/season/${seasonId}/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ round, teamHome, teamAway, espnEventId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to add game');
      }
      return res.json();
    },

    deleteGame: async (seasonId: number, gameId: number): Promise<void> => {
      const res = await fetch(`${API_URL}/season/${seasonId}/games/${gameId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete game');
      }
    },

    bulkDeleteGames: async (seasonId: number, gameIds: number[]): Promise<{ deletedCount: number }> => {
      const res = await fetch(`${API_URL}/season/${seasonId}/games/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ gameIds }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete games');
      }
      return res.json();
    },

    resetGames: async (seasonId: number): Promise<{ deletedCount: number }> => {
      const res = await fetch(`${API_URL}/season/${seasonId}/games`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to reset games');
      }
      return res.json();
    },

    updateScores: async (seasonId: number): Promise<{ success: boolean; updatedCount: number }> => {
      const res = await fetch(`${API_URL}/admin/season/${seasonId}/update-scores`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to update scores');
      return res.json();
    },

    getSeeds: async (seasonId: number): Promise<any[]> => {
      const res = await fetch(`${API_URL}/season/${seasonId}/seeds`);
      if (!res.ok) throw new Error('Failed to get playoff seeds');
      return res.json();
    },

    setSeeds: async (seasonId: number, seeds: Array<{ conference: string; seed: number; team_abbr: string }>): Promise<{ seeds: any[]; games: Game[] }> => {
      const res = await fetch(`${API_URL}/season/${seasonId}/seeds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ seeds }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to set playoff seeds');
      }
      return res.json();
    },

    getTeams: async (seasonId: number): Promise<string[]> => {
      const res = await fetch(`${API_URL}/season/${seasonId}/teams`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to get teams');
      return res.json();
    },

    renameTeam: async (seasonId: number, oldName: string, newName: string): Promise<{ success: boolean; gamesUpdated: number; seedsUpdated: number; predictionsUpdated: number }> => {
      const res = await fetch(`${API_URL}/season/${seasonId}/team/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ oldName, newName }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to rename team');
      }
      return res.json();
    },
  },

  participant: {
    submit: async (
      lobbyId: string,
      name: string,
      predictions: Array<{ gameId: number; predictedWinner: string; predictedOpponent?: string }>
    ): Promise<{ success: boolean; participant: Participant }> => {
      const res = await fetch(`${API_URL}/participant/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lobbyId, name, predictions }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to submit predictions');
      }
      return res.json();
    },

    getParticipants: async (lobbyId: string): Promise<Participant[]> => {
      const res = await fetch(`${API_URL}/participant/${lobbyId}/participants`);
      if (!res.ok) throw new Error('Failed to get participants');
      return res.json();
    },
  },

  leaderboard: {
    get: async (
      lobbyId: string
    ): Promise<{
      lobby: Lobby;
      leaderboard: LeaderboardEntry[];
      stats: { completedGames: number; totalGames: number; progress: number };
    }> => {
      const res = await fetch(`${API_URL}/leaderboard/${lobbyId}`);
      if (!res.ok) throw new Error('Failed to get leaderboard');
      return res.json();
    },
  },

  admin: {
    updateGameWinner: async (gameId: number, winner: string): Promise<void> => {
      const res = await fetch(`${API_URL}/admin/game/${gameId}/winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ winner }),
      });
      if (!res.ok) throw new Error('Failed to update winner');
    },


    searchPlayoffGames: async (year?: number): Promise<any[]> => {
      const url = year
        ? `${API_URL}/admin/espn/playoff-games?year=${year}`
        : `${API_URL}/admin/espn/playoff-games`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to search playoff games');
      return res.json();
    },
  },
};

export type { Admin, Season, Lobby, Game, Participant, LeaderboardEntry };
