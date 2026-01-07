import express from 'express';
import { calculateLeaderboard, getLeaderboardStats } from '../services/leaderboard.js';
import { getLobbyById } from '../services/lobby.js';

const router = express.Router();

router.get('/:lobbyId', async (req, res) => {
  try {
    const lobby = await getLobbyById(req.params.lobbyId);

    if (!lobby) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    const leaderboard = await calculateLeaderboard(lobby.id, lobby.season_id, lobby.scoring_type);
    const stats = await getLeaderboardStats(lobby.season_id);

    res.json({
      lobby,
      leaderboard,
      stats,
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

export default router;
