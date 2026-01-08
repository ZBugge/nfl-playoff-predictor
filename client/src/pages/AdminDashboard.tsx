import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, type Admin, type Lobby, type Season } from '../api/api'

function AdminDashboard() {
  const navigate = useNavigate()
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [lobbies, setLobbies] = useState<Lobby[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const adminData = await api.auth.me()
      setAdmin(adminData)

      const lobbiesData = await api.lobby.getMyLobbies()
      setLobbies(lobbiesData)

      if (adminData.is_super_admin) {
        const seasonsData = await api.season.getAll()
        setSeasons(seasonsData)
      }
    } catch (err) {
      navigate('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await api.auth.logout()
    navigate('/')
  }

  const copyInviteLink = (lobbyId: string) => {
    const link = `${window.location.origin}/join/${lobbyId}`
    navigator.clipboard.writeText(link)
    alert('Invite link copied to clipboard!')
  }

  const copyLeaderboardLink = (lobbyId: string) => {
    const link = `${window.location.origin}/leaderboard/${lobbyId}`
    navigator.clipboard.writeText(link)
    alert('Leaderboard link copied to clipboard!')
  }

  const handleDeleteLobby = async (lobbyId: string, lobbyName: string) => {
    if (!confirm(`Are you sure you want to delete "${lobbyName}"? This will permanently delete the lobby and all participant predictions. This cannot be undone.`)) {
      return
    }

    try {
      await api.lobby.delete(lobbyId)
      await loadData()
      alert('Lobby deleted successfully')
    } catch (err: any) {
      alert('Failed to delete lobby: ' + err.message)
    }
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <div className="container">
      <div className="header">
        <div className="nav">
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>NFL Playoff Predictor</h1>
          <div className="nav-links">
            <span style={{ color: 'white' }}>Welcome, {admin?.username} {!!admin?.is_super_admin && '(Super Admin)'}</span>
            <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
              Logout
            </button>
          </div>
        </div>
      </div>

      {!!admin?.is_super_admin && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ margin: 0 }}>Seasons</h2>
            <Link to="/admin/create-season" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Create New Season
            </Link>
          </div>

          {seasons.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#a0aec0' }}>
              <p>No seasons yet. Create your first season to get started!</p>
            </div>
          ) : (
            <div className="grid">
              {seasons.map((season) => (
                <div key={season.id} className="game-card">
                  <div style={{ marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>{season.name}</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span className={`badge badge-${season.status === 'active' ? 'success' : 'info'}`}>
                        {season.status.toUpperCase()}
                      </span>
                      <span style={{ color: '#718096', fontSize: '0.875rem' }}>
                        {season.year} • {season.sport}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Link
                      to={`/admin/season/${season.id}`}
                      className="btn btn-primary"
                      style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', textDecoration: 'none' }}
                    >
                      Manage Games
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ margin: 0 }}>My Lobbies</h2>
          <Link to="/admin/create-lobby" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Create New Lobby
          </Link>
        </div>

        {lobbies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#a0aec0' }}>
            <p>No lobbies yet. Create your first lobby to get started!</p>
          </div>
        ) : (
          <div className="grid">
            {lobbies.map((lobby) => (
              <div key={lobby.id} className="game-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>{lobby.name}</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span className={`badge badge-${lobby.status === 'open' ? 'info' : lobby.status === 'in_progress' ? 'warning' : 'success'}`}>
                        {lobby.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="badge badge-info">
                        {lobby.scoring_type === 'both' ? 'Both Scoring Types' : lobby.scoring_type.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => copyInviteLink(lobby.id)}
                    className="btn btn-secondary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                  >
                    Copy Invite Link
                  </button>
                  <button
                    onClick={() => copyLeaderboardLink(lobby.id)}
                    className="btn btn-secondary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                  >
                    Copy Leaderboard Link
                  </button>
                  <Link
                    to={`/leaderboard/${lobby.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', textDecoration: 'none' }}
                  >
                    View Leaderboard
                  </Link>
                  <button
                    onClick={() => handleDeleteLobby(lobby.id, lobby.name)}
                    className="btn btn-danger"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                  >
                    Delete Lobby
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminDashboard
