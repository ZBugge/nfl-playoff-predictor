import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getAdminById } from '../auth/auth.js';
import { updateGameWinner } from '../services/season.js';
import { updateSeasonScoresFromESPN, searchPlayoffGames } from '../services/espn.js';
import { getSystemStats } from '../services/stats.js';

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

router.post('/game/:gameId/winner', requireAuth, async (req, res) => {
  try {
    const { winner } = req.body;

    if (!winner) {
      return res.status(400).json({ error: 'Winner required' });
    }

    await updateGameWinner(Number(req.params.gameId), winner);

    res.json({ success: true });
  } catch (error) {
    console.error('Update winner error:', error);
    res.status(500).json({ error: 'Failed to update winner' });
  }
});

router.post('/season/:seasonId/update-scores', requireAuth, async (req, res) => {
  try {
    const updatedCount = await updateSeasonScoresFromESPN(Number(req.params.seasonId));

    res.json({
      success: true,
      updatedCount,
    });
  } catch (error) {
    console.error('Update scores error:', error);
    res.status(500).json({ error: 'Failed to update scores' });
  }
});

router.get('/espn/playoff-games', requireAuth, async (req, res) => {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const games = await searchPlayoffGames(year);

    res.json(games);
  } catch (error) {
    console.error('Search playoff games error:', error);
    res.status(500).json({ error: 'Failed to search playoff games' });
  }
});

// Get system stats (super admin only)
router.get('/stats', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const seasonId = req.query.seasonId ? Number(req.query.seasonId) : undefined;
    const stats = await getSystemStats(seasonId);
    res.json(stats);
  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({ error: 'Failed to get system stats' });
  }
});

export default router;
