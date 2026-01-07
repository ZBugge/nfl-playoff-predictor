import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createLobby,
  getLobbyById,
  getLobbiesByAdmin,
  deleteParticipant,
  deleteMultipleParticipants,
  deleteLobby,
  getParticipantById,
} from '../services/lobby.js';
import { getGamesBySeason } from '../services/season.js';
import { canCreateLobby } from '../services/limits.js';

const router = express.Router();

router.post('/create', requireAuth, async (req, res) => {
  try {
    const { name, scoringType, seasonId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Lobby name required' });
    }

    if (!seasonId) {
      return res.status(400).json({ error: 'Season required' });
    }

    const validScoringTypes = ['simple', 'weighted', 'bracket', 'both'];
    if (!validScoringTypes.includes(scoringType)) {
      return res.status(400).json({ error: 'Invalid scoring type' });
    }

    // Check if admin can create another lobby
    const limitCheck = await canCreateLobby(req.session.adminId!);
    if (!limitCheck.allowed) {
      return res.status(429).json({ error: limitCheck.reason });
    }

    const lobby = await createLobby(req.session.adminId!, seasonId, name, scoringType);

    res.json(lobby);
  } catch (error) {
    console.error('Create lobby error:', error);
    res.status(500).json({ error: 'Failed to create lobby' });
  }
});

router.get('/my-lobbies', requireAuth, async (req, res) => {
  try {
    const lobbies = await getLobbiesByAdmin(req.session.adminId!);
    res.json(lobbies);
  } catch (error) {
    console.error('Get lobbies error:', error);
    res.status(500).json({ error: 'Failed to get lobbies' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const lobby = await getLobbyById(req.params.id);

    if (!lobby) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    res.json(lobby);
  } catch (error) {
    console.error('Get lobby error:', error);
    res.status(500).json({ error: 'Failed to get lobby' });
  }
});

router.get('/:id/games', async (req, res) => {
  try {
    const lobby = await getLobbyById(req.params.id);

    if (!lobby) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    const games = await getGamesBySeason(lobby.season_id);
    res.json(games);
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({ error: 'Failed to get games' });
  }
});

// Delete a single participant (admin only, must own the lobby)
router.delete('/:lobbyId/participants/:participantId', requireAuth, async (req, res) => {
  try {
    const { lobbyId, participantId } = req.params;

    const lobby = await getLobbyById(lobbyId);
    if (!lobby) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    if (lobby.admin_id !== req.session.adminId) {
      return res.status(403).json({ error: 'Only lobby owner can delete participants' });
    }

    const participant = await getParticipantById(Number(participantId));
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    if (participant.lobby_id !== lobbyId) {
      return res.status(403).json({ error: 'Participant does not belong to this lobby' });
    }

    await deleteParticipant(Number(participantId));
    res.json({ success: true });
  } catch (error) {
    console.error('Delete participant error:', error);
    res.status(500).json({ error: 'Failed to delete participant' });
  }
});

// Bulk delete participants (admin only, must own the lobby)
router.post('/:lobbyId/participants/bulk-delete', requireAuth, async (req, res) => {
  try {
    const { lobbyId } = req.params;
    const { participantIds } = req.body;

    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ error: 'participantIds must be a non-empty array' });
    }

    const lobby = await getLobbyById(lobbyId);
    if (!lobby) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    if (lobby.admin_id !== req.session.adminId) {
      return res.status(403).json({ error: 'Only lobby owner can delete participants' });
    }

    // Verify all participants belong to this lobby
    for (const id of participantIds) {
      const participant = await getParticipantById(Number(id));
      if (!participant || participant.lobby_id !== lobbyId) {
        return res.status(403).json({ error: `Participant ${id} does not belong to this lobby` });
      }
    }

    await deleteMultipleParticipants(participantIds.map(Number));
    res.json({ success: true, deletedCount: participantIds.length });
  } catch (error) {
    console.error('Bulk delete participants error:', error);
    res.status(500).json({ error: 'Failed to delete participants' });
  }
});

// Delete entire lobby (admin only, must own the lobby)
router.delete('/:lobbyId', requireAuth, async (req, res) => {
  try {
    const { lobbyId } = req.params;

    const lobby = await getLobbyById(lobbyId);
    if (!lobby) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    if (lobby.admin_id !== req.session.adminId) {
      return res.status(403).json({ error: 'Only lobby owner can delete lobby' });
    }

    await deleteLobby(lobbyId);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete lobby error:', error);
    res.status(500).json({ error: 'Failed to delete lobby' });
  }
});

export default router;
