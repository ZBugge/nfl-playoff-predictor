import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { api, type Lobby, type LeaderboardEntry, type Admin } from '../api/api'

function Leaderboard() {
  const { lobbyId } = useParams<{ lobbyId: string }>()
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [stats, setStats] = useState({ completedGames: 0, totalGames: 0, progress: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showWeighted, setShowWeighted] = useState(false)
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [selectedParticipants, setSelectedParticipants] = useState<Set<number>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadData()
    loadAdmin()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [lobbyId])

  const loadData = async () => {
    try {
      const data = await api.leaderboard.get(lobbyId!)
      setLobby(data.lobby)
      setLeaderboard(data.leaderboard)
      setStats(data.stats)
      setError('')
      setSelectedParticipants(new Set()) // Clear selections on reload
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadAdmin = async () => {
    try {
      const adminData = await api.auth.me()
      setAdmin(adminData)
    } catch (err) {
      // Not logged in, that's fine
      setAdmin(null)
    }
  }

  const toggleParticipant = (participantId: number) => {
    const newSelected = new Set(selectedParticipants)
    if (newSelected.has(participantId)) {
      newSelected.delete(participantId)
    } else {
      newSelected.add(participantId)
    }
    setSelectedParticipants(newSelected)
  }

  const toggleAll = () => {
    if (selectedParticipants.size === leaderboard.length) {
      setSelectedParticipants(new Set())
    } else {
      setSelectedParticipants(new Set(leaderboard.map(e => e.participantId)))
    }
  }

  const handleDelete = async () => {
    if (selectedParticipants.size === 0) return

    if (!confirm(`Are you sure you want to delete ${selectedParticipants.size} participant(s)? This cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    try {
      await api.lobby.bulkDeleteParticipants(lobbyId!, Array.from(selectedParticipants))
      await loadData()
    } catch (err: any) {
      alert('Failed to delete participants: ' + err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const copyInviteLink = () => {
    const link = `${window.location.origin}/join/${lobbyId}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isLobbyOwner = admin && lobby && admin.id === lobby.admin_id

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (error) {
    return (
      <div className="container">
        <div className="card">
          <div className="error">{error}</div>
        </div>
      </div>
    )
  }

  const sortedLeaderboard = showWeighted && lobby?.scoring_type === 'both'
    ? [...leaderboard].sort((a, b) => b.weightedScore - a.weightedScore)
    : leaderboard

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  return (
    <div className="container">
      <div className="leaderboard-container">
        <h1>{lobby?.name}</h1>

        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <button
            onClick={copyInviteLink}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            {copied ? 'Link Copied!' : 'Share Invite Link'}
          </button>
          <p style={{ color: '#a0aec0', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Invite friends to make their predictions
          </p>
        </div>

        <div className="card">
          <div className="leaderboard-header">
            <div className="leaderboard-header-info">
              <h3 className="leaderboard-header-title">Leaderboard</h3>
              <p className="leaderboard-header-progress">
                {stats.completedGames} of {stats.totalGames} games completed ({stats.progress.toFixed(0)}%)
              </p>
            </div>
            <div className="leaderboard-header-actions">
              {isLobbyOwner && selectedParticipants.size > 0 && (
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="btn btn-danger btn-compact"
                >
                  {isDeleting ? 'Deleting...' : `Delete (${selectedParticipants.size})`}
                </button>
              )}
              <button onClick={loadData} className="btn btn-secondary btn-compact">
                Refresh
              </button>
            </div>
          </div>

          {lobby?.scoring_type === 'both' && (
            <div className="leaderboard-scoring-toggle">
              <button
                onClick={() => setShowWeighted(false)}
                className={`btn ${!showWeighted ? 'btn-primary' : 'btn-secondary'} btn-compact`}
              >
                Simple Scoring
              </button>
              <button
                onClick={() => setShowWeighted(true)}
                className={`btn ${showWeighted ? 'btn-primary' : 'btn-secondary'} btn-compact`}
              >
                Weighted Scoring
              </button>
            </div>
          )}

          {lobby?.scoring_type === 'both' && (
            <div style={{
              backgroundColor: '#f7fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.375rem',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              color: '#4a5568',
              fontSize: '0.875rem'
            }}>
              When simple scores are tied, weighted score determines the ranking.
            </div>
          )}

          {leaderboard.length === 0 ? (
            <p className="leaderboard-empty">
              No participants yet. Be the first to join!
            </p>
          ) : (
            <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    {isLobbyOwner && (
                      <th style={{ width: '40px' }}>
                        <input
                          type="checkbox"
                          checked={selectedParticipants.size === leaderboard.length && leaderboard.length > 0}
                          onChange={toggleAll}
                          style={{ cursor: 'pointer' }}
                        />
                      </th>
                    )}
                    <th>Rank</th>
                    <th>Name</th>
                    <th>Score</th>
                    <th>Correct Picks</th>
                    <th>Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLeaderboard.map((entry, index) => {
                    const score = showWeighted ? entry.weightedScore : entry.simpleScore
                    const accuracy = entry.totalPicks > 0
                      ? ((entry.correctPicks / entry.totalPicks) * 100).toFixed(1)
                      : '0.0'

                    return (
                      <tr key={entry.participantId}>
                        {isLobbyOwner && (
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedParticipants.has(entry.participantId)}
                              onChange={() => toggleParticipant(entry.participantId)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                        )}
                        <td>
                          <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                            {getRankEmoji(index + 1)}
                          </span>
                        </td>
                        <td style={{ fontWeight: index === 0 ? 'bold' : 'normal', fontSize: index === 0 ? '1.125rem' : '1rem' }}>
                          {entry.name}
                          {index === 0 && stats.progress === 100 && ' 👑'}
                        </td>
                        <td>
                          <span style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#667eea' }}>
                            {score.toFixed(2)}
                          </span>
                          {lobby?.scoring_type === 'both' && !showWeighted && entry.weightedScore !== score && (
                            <span style={{ fontSize: '0.875rem', color: '#a0aec0', marginLeft: '0.5rem' }}>
                              ({entry.weightedScore.toFixed(2)} weighted)
                            </span>
                          )}
                          {lobby?.scoring_type === 'both' && showWeighted && entry.simpleScore !== score && (
                            <span style={{ fontSize: '0.875rem', color: '#a0aec0', marginLeft: '0.5rem' }}>
                              ({entry.simpleScore.toFixed(2)} simple)
                            </span>
                          )}
                        </td>
                        <td>
                          {entry.correctPicks} / {entry.totalPicks}
                        </td>
                        <td>
                          <span className={`badge ${accuracy === '100.0' ? 'badge-success' : 'badge-info'}`}>
                            {accuracy}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARD VIEW */}
            <div className="show-mobile">
              {sortedLeaderboard.map((entry, index) => {
                const score = showWeighted ? entry.weightedScore : entry.simpleScore
                const accuracy = entry.totalPicks > 0
                  ? ((entry.correctPicks / entry.totalPicks) * 100).toFixed(1)
                  : '0.0'

                return (
                  <div key={entry.participantId} className="leaderboard-card">
                    {isLobbyOwner && (
                      <input
                        type="checkbox"
                        checked={selectedParticipants.has(entry.participantId)}
                        onChange={() => toggleParticipant(entry.participantId)}
                        className="leaderboard-card-checkbox"
                      />
                    )}

                    <div className="leaderboard-card-rank">
                      {getRankEmoji(index + 1)}
                    </div>

                    <div className="leaderboard-card-content">
                      <div className="leaderboard-card-name">
                        {entry.name}
                        {index === 0 && stats.progress === 100 && ' 👑'}
                      </div>

                      <div className="leaderboard-card-score">
                        {score.toFixed(2)}
                      </div>

                      {lobby?.scoring_type === 'both' && (
                        <div className="leaderboard-card-secondary-score">
                          {!showWeighted && entry.weightedScore !== score &&
                            `${entry.weightedScore.toFixed(2)} weighted`}
                          {showWeighted && entry.simpleScore !== score &&
                            `${entry.simpleScore.toFixed(2)} simple`}
                        </div>
                      )}

                      <div className="leaderboard-card-stats">
                        <div className="leaderboard-card-stat">
                          <span className="leaderboard-card-stat-label">Correct</span>
                          <span className="leaderboard-card-stat-value">
                            {entry.correctPicks} / {entry.totalPicks}
                          </span>
                        </div>
                        <div className="leaderboard-card-stat">
                          <span className="leaderboard-card-stat-label">Accuracy</span>
                          <span className="leaderboard-card-stat-value">
                            <span className={`badge ${accuracy === '100.0' ? 'badge-success' : 'badge-info'}`}>
                              {accuracy}%
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            </>
          )}

          {stats.progress === 100 && leaderboard.length > 0 && (
            <div className="leaderboard-champion-banner">
              <h2 className="leaderboard-champion-title">
                🎉 Playoffs Complete! 🎉
              </h2>
              <p className="leaderboard-champion-subtitle">
                {sortedLeaderboard[0].name} is the champion!
              </p>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Scoring System</h3>
          <div style={{ color: '#718096' }}>
            {(lobby?.scoring_type === 'simple' || lobby?.scoring_type === 'both') && (
              <div style={{ marginBottom: '1rem' }}>
                <strong>Simple Scoring:</strong> 1 point per correct prediction
              </div>
            )}
            {(lobby?.scoring_type === 'weighted' || lobby?.scoring_type === 'both') && (
              <div>
                <strong>Weighted Scoring:</strong>
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                  <li>Wild Card Round: 1 point</li>
                  <li>Divisional Round: 2 points</li>
                  <li>Conference Championship: 3 points</li>
                  <li>Super Bowl: 5 points</li>
                </ul>
              </div>
            )}
            {lobby?.scoring_type === 'bracket' && (
              <div>
                <strong>Bracket Scoring:</strong> You only earn points if your prediction path is correct (like March Madness)
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Leaderboard
