import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api/api'

function CreateSeason() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [sport, setSport] = useState('NFL')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const season = await api.season.create(name, year, sport)
      navigate(`/admin/season/${season.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div style={{ maxWidth: '600px', margin: '4rem auto' }}>
        <h1>Create New Season</h1>

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Season Name</label>
              <input
                id="name"
                type="text"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., 2024-2025 NFL Playoffs"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="year">Year</label>
              <input
                id="year"
                type="number"
                className="input"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min="2020"
                max="2099"
                required
              />
              <p style={{ fontSize: '0.875rem', color: '#718096', marginTop: '0.5rem' }}>
                The year the playoffs take place (e.g., 2025 for 2024-2025 season)
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="sport">Sport</label>
              <select
                id="sport"
                className="select"
                value={sport}
                onChange={(e) => setSport(e.target.value)}
              >
                <option value="NFL">NFL</option>
                <option value="NBA">NBA</option>
                <option value="NHL">NHL</option>
                <option value="MLB">MLB</option>
              </select>
              <p style={{ fontSize: '0.875rem', color: '#718096', marginTop: '0.5rem' }}>
                Currently only NFL is fully supported
              </p>
            </div>

            {error && <div className="error">{error}</div>}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Creating...' : 'Create Season'}
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

export default CreateSeason
