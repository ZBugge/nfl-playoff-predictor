import { runQuery, runExec, type SystemConfig } from '../db/schema.js';

// HARD CAPS - These cannot be exceeded even by super admin
// These protect against catastrophic cost scenarios
export const HARD_CAPS = {
  MAX_ADMINS: 1000,
  MAX_LOBBIES_PER_ADMIN: 50,
  MAX_PARTICIPANTS_PER_LOBBY: 500,
  MAX_ACTIVE_SEASONS: 20,
} as const;

export async function getSystemConfig(): Promise<SystemConfig> {
  const results = await runQuery<SystemConfig>('SELECT * FROM system_config WHERE id = 1', []);
  return results[0];
}

export async function updateSystemConfig(config: Partial<Omit<SystemConfig, 'id' | 'updated_at'>>): Promise<SystemConfig> {
  const current = await getSystemConfig();

  // Enforce hard caps
  const newConfig = {
    max_admins: Math.min(config.max_admins ?? current.max_admins, HARD_CAPS.MAX_ADMINS),
    max_lobbies_per_admin: Math.min(config.max_lobbies_per_admin ?? current.max_lobbies_per_admin, HARD_CAPS.MAX_LOBBIES_PER_ADMIN),
    max_participants_per_lobby: Math.min(config.max_participants_per_lobby ?? current.max_participants_per_lobby, HARD_CAPS.MAX_PARTICIPANTS_PER_LOBBY),
    max_active_seasons: Math.min(config.max_active_seasons ?? current.max_active_seasons, HARD_CAPS.MAX_ACTIVE_SEASONS),
  };

  await runExec(
    `UPDATE system_config
     SET max_admins = ?,
         max_lobbies_per_admin = ?,
         max_participants_per_lobby = ?,
         max_active_seasons = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = 1`,
    [
      newConfig.max_admins,
      newConfig.max_lobbies_per_admin,
      newConfig.max_participants_per_lobby,
      newConfig.max_active_seasons,
    ]
  );

  return getSystemConfig();
}

// Check if adding a new admin would exceed limits
export async function canCreateAdmin(): Promise<{ allowed: boolean; reason?: string }> {
  const config = await getSystemConfig();
  const adminCount = await runQuery<{ count: number }>('SELECT COUNT(*) as count FROM admins', []);

  if (adminCount[0].count >= config.max_admins) {
    return {
      allowed: false,
      reason: `Maximum number of admins reached (${config.max_admins}). Contact the site administrator.`,
    };
  }

  return { allowed: true };
}

// Check if admin can create another lobby
export async function canCreateLobby(adminId: number): Promise<{ allowed: boolean; reason?: string }> {
  const config = await getSystemConfig();
  const lobbyCount = await runQuery<{ count: number }>(
    'SELECT COUNT(*) as count FROM lobbies WHERE admin_id = ?',
    [adminId]
  );

  if (lobbyCount[0].count >= config.max_lobbies_per_admin) {
    return {
      allowed: false,
      reason: `You have reached the maximum number of lobbies (${config.max_lobbies_per_admin}). Delete some lobbies to create new ones.`,
    };
  }

  return { allowed: true };
}

// Check if lobby can accept another participant
export async function canAddParticipant(lobbyId: string): Promise<{ allowed: boolean; reason?: string }> {
  const config = await getSystemConfig();
  const participantCount = await runQuery<{ count: number }>(
    'SELECT COUNT(*) as count FROM participants WHERE lobby_id = ?',
    [lobbyId]
  );

  if (participantCount[0].count >= config.max_participants_per_lobby) {
    return {
      allowed: false,
      reason: `This lobby has reached its maximum capacity (${config.max_participants_per_lobby} participants).`,
    };
  }

  return { allowed: true };
}

// Check if a new active season can be created
export async function canCreateActiveSeason(): Promise<{ allowed: boolean; reason?: string }> {
  const config = await getSystemConfig();
  const activeSeasonCount = await runQuery<{ count: number }>(
    "SELECT COUNT(*) as count FROM seasons WHERE status = 'active'",
    []
  );

  if (activeSeasonCount[0].count >= config.max_active_seasons) {
    return {
      allowed: false,
      reason: `Maximum number of active seasons reached (${config.max_active_seasons}). Archive some seasons first.`,
    };
  }

  return { allowed: true };
}

// Get current usage statistics
export async function getUsageStats() {
  const config = await getSystemConfig();

  const [adminCount, lobbyCount, seasonCount] = await Promise.all([
    runQuery<{ count: number }>('SELECT COUNT(*) as count FROM admins', []),
    runQuery<{ count: number }>('SELECT COUNT(*) as count FROM lobbies', []),
    runQuery<{ count: number }>("SELECT COUNT(*) as count FROM seasons WHERE status = 'active'", []),
  ]);

  // Get participant counts per lobby
  const participantCounts = await runQuery<{ lobby_id: string; count: number }>(
    'SELECT lobby_id, COUNT(*) as count FROM participants GROUP BY lobby_id ORDER BY count DESC LIMIT 10',
    []
  );

  // Get lobbies per admin
  const lobbyCountsByAdmin = await runQuery<{ admin_id: number; count: number }>(
    'SELECT admin_id, COUNT(*) as count FROM lobbies GROUP BY admin_id ORDER BY count DESC LIMIT 10',
    []
  );

  return {
    config,
    hardCaps: HARD_CAPS,
    usage: {
      admins: {
        current: adminCount[0].count,
        limit: config.max_admins,
        percentage: Math.round((adminCount[0].count / config.max_admins) * 100),
      },
      lobbies: {
        current: lobbyCount[0].count,
        topAdminCounts: lobbyCountsByAdmin,
      },
      activeSeasons: {
        current: seasonCount[0].count,
        limit: config.max_active_seasons,
        percentage: Math.round((seasonCount[0].count / config.max_active_seasons) * 100),
      },
      participants: {
        topLobbyCounts: participantCounts,
      },
    },
  };
}
