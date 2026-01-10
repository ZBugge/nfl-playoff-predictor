import express from 'express';
import {
  getLobbyById,
  addParticipant,
  getParticipantsByLobby,
  addPrediction,
} from '../services/lobby.js';
import { getGamesBySeason } from '../services/season.js';
import { canAddParticipant } from '../services/limits.js';
import { getParticipantBracket } from '../services/bracket.js';

const router = express.Router();

router.post('/submit', async (req, res) => {
  try {
    // TEMP close the lobby
    if(req.headers){
      return res.status(400).json({ error: 'Submissions are closed' });
    }
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

router.get('/:participantId/bracket', async (req, res) => {
  try {
    const participantId = parseInt(req.params.participantId);
    const seasonId = parseInt(req.query.seasonId as string);

    if (isNaN(participantId) || isNaN(seasonId)) {
      return res.status(400).json({ error: 'Invalid participantId or seasonId' });
    }

    const bracketData = await getParticipantBracket(participantId, seasonId);

    if (!bracketData) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    res.json(bracketData);
  } catch (error) {
    console.error('Get participant bracket error:', error);
    res.status(500).json({ error: 'Failed to get participant bracket' });
  }
});

export default router;
