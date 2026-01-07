import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getAdminById } from '../auth/auth.js';
import {
  createSeason,
  getAllSeasons,
  getActiveSeasons,
  getSeasonById,
  updateSeasonStatus,
  addGameToSeason,
  getGamesBySeason,
  deleteGame,
  deleteMultipleGames,
  deleteAllGamesForSeason,
  getGameById,
  setPlayoffSeed,
  getPlayoffSeeds,
  generatePlayoffGamesFromSeeds,
} from '../services/season.js';
import { canCreateActiveSeason, getSystemConfig, updateSystemConfig, getUsageStats, HARD_CAPS } from '../services/limits.js';

const router = express.Router();

// Middleware to check if user is super admin
async function requireSuperAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.session.adminId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const admin = await getAdminById(req.session.adminId);
  if (!admin?.is_super_admin) {
    return res.status(403).json({ error: 'Super admin access required' });
  }

  next();
}

// Get all seasons (for super admin)
router.get('/all', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const seasons = await getAllSeasons();
    res.json(seasons);
  } catch (error) {
    console.error('Get all seasons error:', error);
    res.status(500).json({ error: 'Failed to get seasons' });
  }
});

// Get active seasons (for regular admins creating lobbies)
router.get('/active', requireAuth, async (req, res) => {
  try {
    const seasons = await getActiveSeasons();
    res.json(seasons);
  } catch (error) {
    console.error('Get active seasons error:', error);
    res.status(500).json({ error: 'Failed to get active seasons' });
  }
});

// Create a new season (super admin only)
router.post('/create', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { name, year, sport } = req.body;

    if (!name || !year) {
      return res.status(400).json({ error: 'Name and year required' });
    }

    // Check if we can create another active season
    const limitCheck = await canCreateActiveSeason();
    if (!limitCheck.allowed) {
      return res.status(429).json({ error: limitCheck.reason });
    }

    const season = await createSeason(name, year, sport);
    res.json(season);
  } catch (error) {
    console.error('Create season error:', error);
    res.status(500).json({ error: 'Failed to create season' });
  }
});

// Update season status (super admin only)
router.patch('/:id/status', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    if (status !== 'active' && status !== 'archived') {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await updateSeasonStatus(Number(req.params.id), status);
    res.json({ success: true });
  } catch (error) {
    console.error('Update season status error:', error);
    res.status(500).json({ error: 'Failed to update season status' });
  }
});

// Get games for a season
router.get('/:id/games', async (req, res) => {
  try {
    const games = await getGamesBySeason(Number(req.params.id));
    res.json(games);
  } catch (error) {
    console.error('Get season games error:', error);
    res.status(500).json({ error: 'Failed to get games' });
  }
});

// Add game to season (super admin only)
router.post('/:id/games', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { round, teamHome, teamAway, espnEventId, seedHome, seedAway, isActualMatchup } = req.body;

    if (!round || !teamHome || !teamAway) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const game = await addGameToSeason(
      Number(req.params.id),
      round,
      teamHome,
      teamAway,
      espnEventId,
      seedHome,
      seedAway,
      isActualMatchup
    );

    res.json(game);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Game already exists for this round and number' });
    }
    console.error('Add game error:', error);
    res.status(500).json({ error: 'Failed to add game' });
  }
});

// Delete game from season (super admin only)
router.delete('/:seasonId/games/:gameId', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const game = await getGameById(Number(req.params.gameId));

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.season_id !== Number(req.params.seasonId)) {
      return res.status(403).json({ error: 'Game does not belong to this season' });
    }

    await deleteGame(Number(req.params.gameId));
    res.json({ success: true });
  } catch (error) {
    console.error('Delete game error:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

// Bulk delete games from season (super admin only)
router.post('/:seasonId/games/bulk-delete', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { gameIds } = req.body;

    if (!Array.isArray(gameIds) || gameIds.length === 0) {
      return res.status(400).json({ error: 'gameIds must be a non-empty array' });
    }

    // Verify all games belong to this season
    for (const id of gameIds) {
      const game = await getGameById(Number(id));
      if (!game || game.season_id !== Number(req.params.seasonId)) {
        return res.status(403).json({ error: `Game ${id} does not belong to this season` });
      }
    }

    await deleteMultipleGames(gameIds.map(Number));
    res.json({ success: true, deletedCount: gameIds.length });
  } catch (error) {
    console.error('Bulk delete games error:', error);
    res.status(500).json({ error: 'Failed to delete games' });
  }
});

// Reset (delete all games) for a season (super admin only)
router.delete('/:seasonId/games', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const games = await getGamesBySeason(Number(req.params.seasonId));
    const deletedCount = games.length;

    await deleteAllGamesForSeason(Number(req.params.seasonId));
    res.json({ success: true, deletedCount });
  } catch (error) {
    console.error('Delete all games error:', error);
    res.status(500).json({ error: 'Failed to delete all games' });
  }
});

// Get system limits configuration (super admin only)
router.get('/limits/config', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const config = await getSystemConfig();
    res.json({ config, hardCaps: HARD_CAPS });
  } catch (error) {
    console.error('Get limits config error:', error);
    res.status(500).json({ error: 'Failed to get limits configuration' });
  }
});

// Update system limits (super admin only)
router.patch('/limits/config', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { max_admins, max_lobbies_per_admin, max_participants_per_lobby, max_active_seasons } = req.body;

    const updatedConfig = await updateSystemConfig({
      max_admins,
      max_lobbies_per_admin,
      max_participants_per_lobby,
      max_active_seasons,
    });

    res.json({ config: updatedConfig, hardCaps: HARD_CAPS });
  } catch (error) {
    console.error('Update limits config error:', error);
    res.status(500).json({ error: 'Failed to update limits configuration' });
  }
});

// Get usage statistics (super admin only)
router.get('/limits/stats', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const stats = await getUsageStats();
    res.json(stats);
  } catch (error) {
    console.error('Get usage stats error:', error);
    res.status(500).json({ error: 'Failed to get usage statistics' });
  }
});

// Playoff seeding endpoints

// Get playoff seeds for a season
router.get('/:seasonId/seeds', async (req, res) => {
  try {
    const seeds = await getPlayoffSeeds(Number(req.params.seasonId));
    res.json(seeds);
  } catch (error) {
    console.error('Get playoff seeds error:', error);
    res.status(500).json({ error: 'Failed to get playoff seeds' });
  }
});

// Set playoff seeds and generate games (super admin only)
router.post('/:seasonId/seeds', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { seasonId } = req.params;
    const { seeds } = req.body;

    if (!Array.isArray(seeds) || seeds.length === 0) {
      return res.status(400).json({ error: 'seeds must be a non-empty array' });
    }

    // Validate that we have exactly 14 seeds (7 per conference)
    if (seeds.length !== 14) {
      return res.status(400).json({ error: 'Must provide exactly 14 seeds (7 for AFC, 7 for NFC)' });
    }

    // Set all seeds
    for (const seed of seeds) {
      if (!seed.conference || !seed.seed || !seed.team_abbr) {
        return res.status(400).json({ error: 'Each seed must have conference, seed, and team_abbr' });
      }

      await setPlayoffSeed(
        Number(seasonId),
        seed.conference as 'AFC' | 'NFC',
        seed.seed,
        seed.team_abbr
      );
    }

    // Generate games from seeds
    await generatePlayoffGamesFromSeeds(Number(seasonId));

    // Return the created seeds and games
    const createdSeeds = await getPlayoffSeeds(Number(seasonId));
    const games = await getGamesBySeason(Number(seasonId));

    res.json({ seeds: createdSeeds, games });
  } catch (error: any) {
    console.error('Set playoff seeds error:', error);
    res.status(500).json({ error: error.message || 'Failed to set playoff seeds' });
  }
});

export default router;
