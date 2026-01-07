import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { updateGameWinner } from '../services/season.js';
import { updateSeasonScoresFromESPN, searchPlayoffGames } from '../services/espn.js';

const router = express.Router();

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

export default router;
