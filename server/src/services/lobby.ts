import { nanoid } from 'nanoid';
import { runQuery, runInsert, runExec, type Lobby, type Participant, type Prediction } from '../db/schema.js';

export async function createLobby(adminId: number, seasonId: number, name: string, scoringType: Lobby['scoring_type']): Promise<Lobby> {
  const lobbyId = nanoid(10);

  await runExec(
    'INSERT INTO lobbies (id, admin_id, season_id, name, scoring_type) VALUES (?, ?, ?, ?, ?)',
    [lobbyId, adminId, seasonId, name, scoringType]
  );

  return (await getLobbyById(lobbyId))!;
}

export async function getLobbyById(id: string): Promise<Lobby | undefined> {
  const results = await runQuery<Lobby>('SELECT * FROM lobbies WHERE id = ?', [id]);
  return results[0];
}

export async function getLobbiesByAdmin(adminId: number): Promise<Lobby[]> {
  return runQuery<Lobby>('SELECT * FROM lobbies WHERE admin_id = ? ORDER BY created_at DESC', [adminId]);
}

export async function addParticipant(lobbyId: string, name: string): Promise<Participant> {
  const id = await runInsert('INSERT INTO participants (lobby_id, name) VALUES (?, ?)', [lobbyId, name]);
  return (await getParticipantById(id))!;
}

export async function getParticipantById(id: number): Promise<Participant | undefined> {
  const results = await runQuery<Participant>('SELECT * FROM participants WHERE id = ?', [id]);
  return results[0];
}

export async function getParticipantsByLobby(lobbyId: string): Promise<Participant[]> {
  return runQuery<Participant>('SELECT * FROM participants WHERE lobby_id = ? ORDER BY submitted_at', [lobbyId]);
}

export async function addPrediction(participantId: number, gameId: number, predictedWinner: string, predictedOpponent?: string): Promise<void> {
  await runExec(
    'INSERT INTO predictions (participant_id, game_id, predicted_winner, predicted_opponent) VALUES (?, ?, ?, ?)',
    [participantId, gameId, predictedWinner, predictedOpponent || null]
  );
}

export async function getPredictionsByParticipant(participantId: number): Promise<Prediction[]> {
  return runQuery<Prediction>('SELECT * FROM predictions WHERE participant_id = ?', [participantId]);
}

export async function getPredictionsByLobby(lobbyId: string): Promise<Array<Prediction & { participant_id: number; name: string }>> {
  return runQuery<Prediction & { participant_id: number; name: string }>(`
    SELECT p.*, pt.name
    FROM predictions p
    JOIN participants pt ON p.participant_id = pt.id
    WHERE pt.lobby_id = ?
  `, [lobbyId]);
}

export async function deleteParticipant(participantId: number): Promise<void> {
  // Delete all predictions for this participant (CASCADE should handle this, but being explicit)
  await runExec('DELETE FROM predictions WHERE participant_id = ?', [participantId]);
  // Delete the participant
  await runExec('DELETE FROM participants WHERE id = ?', [participantId]);
}

export async function deleteMultipleParticipants(participantIds: number[]): Promise<void> {
  if (participantIds.length === 0) return;

  const placeholders = participantIds.map(() => '?').join(',');

  // Delete all predictions for these participants
  await runExec(`DELETE FROM predictions WHERE participant_id IN (${placeholders})`, participantIds);
  // Delete the participants
  await runExec(`DELETE FROM participants WHERE id IN (${placeholders})`, participantIds);
}

export async function deleteLobby(lobbyId: string): Promise<void> {
  // Get all participants for this lobby
  const participants = await getParticipantsByLobby(lobbyId);
  const participantIds = participants.map(p => p.id);

  // Delete all predictions for all participants in this lobby
  if (participantIds.length > 0) {
    const placeholders = participantIds.map(() => '?').join(',');
    await runExec(`DELETE FROM predictions WHERE participant_id IN (${placeholders})`, participantIds);
  }

  // Delete all participants in this lobby
  await runExec('DELETE FROM participants WHERE lobby_id = ?', [lobbyId]);

  // Delete the lobby
  await runExec('DELETE FROM lobbies WHERE id = ?', [lobbyId]);
}
