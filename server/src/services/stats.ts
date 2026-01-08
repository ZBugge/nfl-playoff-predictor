import { runQuery } from '../db/schema.js';

interface StatsResponse {
  totals: {
    admins: number;
    lobbies: number;
    participants: number;
  };
  topLobbies: Array<{
    id: string;
    name: string;
    participantCount: number;
  }>;
  topAdmins: Array<{
    id: number;
    username: string;
    lobbyCount: number;
    totalParticipants: number;
  }>;
}

export async function getSystemStats(seasonId?: number): Promise<StatsResponse> {
  // Total admins (not filtered by season)
  const adminResult = await runQuery<{ count: number }>(
    'SELECT COUNT(*) as count FROM admins',
    []
  );

  // Total lobbies (optionally filtered by season)
  const lobbyQuery = seasonId
    ? 'SELECT COUNT(*) as count FROM lobbies WHERE season_id = ?'
    : 'SELECT COUNT(*) as count FROM lobbies';
  const lobbyResult = await runQuery<{ count: number }>(
    lobbyQuery,
    seasonId ? [seasonId] : []
  );

  // Total participants (optionally filtered by season)
  const participantQuery = seasonId
    ? `SELECT COUNT(*) as count FROM participants p
       JOIN lobbies l ON p.lobby_id = l.id
       WHERE l.season_id = ?`
    : 'SELECT COUNT(*) as count FROM participants';
  const participantResult = await runQuery<{ count: number }>(
    participantQuery,
    seasonId ? [seasonId] : []
  );

  // Top 3 largest lobbies
  const topLobbiesQuery = seasonId
    ? `SELECT l.id, l.name, COUNT(p.id) as participant_count
       FROM lobbies l
       LEFT JOIN participants p ON l.id = p.lobby_id
       WHERE l.season_id = ?
       GROUP BY l.id
       ORDER BY participant_count DESC
       LIMIT 3`
    : `SELECT l.id, l.name, COUNT(p.id) as participant_count
       FROM lobbies l
       LEFT JOIN participants p ON l.id = p.lobby_id
       GROUP BY l.id
       ORDER BY participant_count DESC
       LIMIT 3`;
  const topLobbiesResult = await runQuery<{ id: string; name: string; participant_count: number }>(
    topLobbiesQuery,
    seasonId ? [seasonId] : []
  );

  // Top 3 most active admins
  const topAdminsQuery = seasonId
    ? `SELECT a.id, a.username,
              COUNT(DISTINCT l.id) as lobby_count,
              COUNT(p.id) as total_participants
       FROM admins a
       LEFT JOIN lobbies l ON a.id = l.admin_id AND l.season_id = ?
       LEFT JOIN participants p ON l.id = p.lobby_id
       GROUP BY a.id
       HAVING lobby_count > 0
       ORDER BY lobby_count DESC, total_participants DESC
       LIMIT 3`
    : `SELECT a.id, a.username,
              COUNT(DISTINCT l.id) as lobby_count,
              COUNT(p.id) as total_participants
       FROM admins a
       LEFT JOIN lobbies l ON a.id = l.admin_id
       LEFT JOIN participants p ON l.id = p.lobby_id
       GROUP BY a.id
       HAVING lobby_count > 0
       ORDER BY lobby_count DESC, total_participants DESC
       LIMIT 3`;
  const topAdminsResult = await runQuery<{
    id: number;
    username: string;
    lobby_count: number;
    total_participants: number;
  }>(topAdminsQuery, seasonId ? [seasonId] : []);

  return {
    totals: {
      admins: adminResult[0]?.count || 0,
      lobbies: lobbyResult[0]?.count || 0,
      participants: participantResult[0]?.count || 0,
    },
    topLobbies: topLobbiesResult.map((l) => ({
      id: l.id,
      name: l.name,
      participantCount: l.participant_count,
    })),
    topAdmins: topAdminsResult.map((a) => ({
      id: a.id,
      username: a.username,
      lobbyCount: a.lobby_count,
      totalParticipants: a.total_participants,
    })),
  };
}
