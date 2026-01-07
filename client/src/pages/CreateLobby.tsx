import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, type Lobby, type Season } from '../api/api'

function CreateLobby() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [scoringType, setScoringType] = useState<Lobby['scoring_type']>('simple')
  const [seasonId, setSeasonId] = useState<number | null>(null)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSeasons, setLoadingSeasons] = useState(true)

  useEffect(() => {
    loadSeasons()
  }, [])

  const loadSeasons = async () => {
    try {
      const activeSeasons = await api.season.getActive()
      setSeasons(activeSeasons)
      if (activeSeasons.length > 0) {
        setSeasonId(activeSeasons[0].id)
      }
    } catch (err: any) {
      setError('Failed to load seasons: ' + err.message)
    } finally {
      setLoadingSeasons(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!seasonId) {
      setError('Please select a season')
      return
    }

    setLoading(true)

    try {
      await api.lobby.create(name, seasonId, scoringType)
      // Navigate back to admin dashboard - games are managed at the season level
      navigate('/admin')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loadingSeasons) {
    return <div className="loading">Loading seasons...</div>
  }

  if (seasons.length === 0) {
    return (
      <div className="container">
        <div style={{ maxWidth: '600px', margin: '4rem auto' }}>
          <div className="card">
            <h2>No Active Seasons</h2>
            <p style={{ color: '#718096', marginBottom: '1rem' }}>
              There are no active seasons available. A super admin must create a season before you can create a lobby.
            </p>
            <Link to="/admin" className="btn btn-secondary">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div style={{ maxWidth: '600px', margin: '4rem auto' }}>
        <h1>Create New Lobby</h1>

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="season">Season</label>
              <select
                id="season"
                className="select"
                value={seasonId || ''}
                onChange={(e) => setSeasonId(Number(e.target.value))}
                required
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name} ({season.year})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="name">Lobby Name</label>
              <input
                id="name"
                type="text"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Smith Family Playoffs 2025"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="scoringType">Scoring Type</label>
              <select
                id="scoringType"
                className="select"
                value={scoringType}
                onChange={(e) => setScoringType(e.target.value as Lobby['scoring_type'])}
              >
                <option value="simple">Simple (1 point per correct pick)</option>
                <option value="weighted">Weighted (More points for later rounds)</option>
                <option value="bracket">Bracket Style (Must get path correct)</option>
                <option value="both">Calculate Both Simple & Weighted</option>
              </select>
              <p style={{ fontSize: '0.875rem', color: '#718096', marginTop: '0.5rem' }}>
                {scoringType === 'simple' && 'Each correct prediction = 1 point'}
                {scoringType === 'weighted' && 'Wild Card=1pt, Divisional=2pts, Conference=3pts, Super Bowl=5pts'}
                {scoringType === 'bracket' && 'Like March Madness - predictions must follow winning path'}
                {scoringType === 'both' && 'Show leaderboards for both simple and weighted scoring'}
              </p>
            </div>

            {error && <div className="error">{error}</div>}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Creating...' : 'Create Lobby'}
              </button>
              <Link to="/admin" className="btn btn-secondary" style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default CreateLobby
