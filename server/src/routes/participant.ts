import express from 'express';
import {
  getLobbyById,
  addParticipant,
  getParticipantsByLobby,
  addPrediction,
} from '../services/lobby.js';
import { getGamesBySeason } from '../services/season.js';
import { canAddParticipant } from '../services/limits.js';

const router = express.Router();

router.post('/submit', async (req, res) => {
  try {
    const { lobbyId, name, predictions } = req.body;

    if (!lobbyId || !name || !predictions || !Array.isArray(predictions)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const lobby = await getLobbyById(lobbyId);

    if (!lobby) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    if (lobby.status === 'completed') {
      return res.status(400).json({ error: 'Lobby is already completed' });
    }

    // Check if lobby can accept another participant
    const limitCheck = await canAddParticipant(lobbyId);
    if (!limitCheck.allowed) {
      return res.status(429).json({ error: limitCheck.reason });
    }

    const games = await getGamesBySeason(lobby.season_id);

    if (predictions.length !== games.length) {
      return res.status(400).json({ error: 'Must predict all games' });
    }

    const participant = await addParticipant(lobbyId, name);

    for (const prediction of predictions) {
      const { gameId, predictedWinner, predictedOpponent } = prediction;

      if (!gameId || !predictedWinner) {
        continue;
      }

      await addPrediction(participant.id, gameId, predictedWinner, predictedOpponent);
    }

    res.json({
      success: true,
      participant,
    });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Name already taken in this lobby' });
    }
    console.error('Submit predictions error:', error);
    res.status(500).json({ error: 'Failed to submit predictions' });
  }
});

router.get('/:lobbyId/participants', async (req, res) => {
  try {
    const participants = await getParticipantsByLobby(req.params.lobbyId);
    res.json(participants);
  } catch (error) {
    console.error('Get participants error:', error);
    res.status(500).json({ error: 'Failed to get participants' });
  }
});

export default router;
