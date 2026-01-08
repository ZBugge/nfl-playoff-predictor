import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, type Season, type Game } from '../api/api'

function SeasonManagement() {
  const { seasonId } = useParams<{ seasonId: string }>()
  const [season, setSeason] = useState<Season | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')

  const [round, setRound] = useState<Game['round']>('wild_card')
  const [teamHome, setTeamHome] = useState('')
  const [teamAway, setTeamAway] = useState('')

  const [selectedGames, setSelectedGames] = useState<Set<number>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  const [afcSeeds, setAfcSeeds] = useState<Record<number, string>>({})
  const [nfcSeeds, setNfcSeeds] = useState<Record<number, string>>({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [showSeedingForm, setShowSeedingForm] = useState(true)

  // Team editing state
  const [teams, setTeams] = useState<string[]>([])
  const [editingTeam, setEditingTeam] = useState<string | null>(null)
  const [newTeamName, setNewTeamName] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [showTeamEditor, setShowTeamEditor] = useState(false)

  const homeTeamInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadData()
  }, [seasonId])

  // Auto-focus home team input on mount for better keyboard UX
  useEffect(() => {
    homeTeamInputRef.current?.focus()
  }, [])

  const loadData = async () => {
    try {
      const gamesData = await api.season.getGames(Number(seasonId!))
      const allSeasons = await api.season.getAll()
      const currentSeason = allSeasons.find(s => s.id === Number(seasonId))
      const seedsData = await api.season.getSeeds(Number(seasonId!))

      setSeason(currentSeason || null)
      setGames(gamesData)
      setSelectedGames(new Set()) // Clear selections on reload

      // If games exist, hide the seeding form
      if (gamesData.length > 0) {
        setShowSeedingForm(false)
      }

      // Load existing seeds into state
      const afcSeedsObj: Record<number, string> = {}
      const nfcSeedsObj: Record<number, string> = {}
      seedsData.forEach((seed: any) => {
        if (seed.conference === 'AFC') {
          afcSeedsObj[seed.seed] = seed.team_abbr
        } else {
          nfcSeedsObj[seed.seed] = seed.team_abbr
        }
      })
      setAfcSeeds(afcSeedsObj)
      setNfcSeeds(nfcSeedsObj)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadTeams = async () => {
    try {
      const teamsData = await api.season.getTeams(Number(seasonId!))
      setTeams(teamsData)
    } catch (err: any) {
      console.error('Failed to load teams:', err)
    }
  }

  const handleRenameTeam = async (oldName: string) => {
    if (!newTeamName.trim()) {
      alert('Please enter a new team name')
      return
    }

    if (newTeamName === oldName) {
      setEditingTeam(null)
      setNewTeamName('')
      return
    }

    setIsRenaming(true)
    try {
      const result = await api.season.renameTeam(Number(seasonId!), oldName, newTeamName)
      alert(`Team renamed! Updated ${result.gamesUpdated} games, ${result.seedsUpdated} seeds, ${result.predictionsUpdated} predictions.`)
      setEditingTeam(null)
      setNewTeamName('')
      await loadData()
      await loadTeams()
    } catch (err: any) {
      alert('Failed to rename team: ' + err.message)
    } finally {
      setIsRenaming(false)
    }
  }

  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await api.season.addGame(Number(seasonId!), round, teamHome, teamAway)
      await loadData()
      setTeamHome('')
      setTeamAway('')

      // Auto-focus home team input for keyboard flow
      setTimeout(() => {
        homeTeamInputRef.current?.focus()
      }, 0)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleUpdateScores = async () => {
    setUpdating(true)
    try {
      const result = await api.season.updateScores(Number(seasonId!))
      alert(`Updated ${result.updatedCount} game(s)`)
      await loadData()
    } catch (err: any) {
      alert('Failed to update scores: ' + err.message)
    } finally {
      setUpdating(false)
    }
  }

  const handleManualWinner = async (gameId: number, winner: string) => {
    try {
      await api.admin.updateGameWinner(gameId, winner)
      await loadData()
    } catch (err: any) {
      alert('Failed to update winner: ' + err.message)
    }
  }

  const handleDeleteGame = async (gameId: number) => {
    if (!confirm('Are you sure you want to delete this game? This cannot be undone.')) {
      return
    }

    try {
      await api.season.deleteGame(Number(seasonId!), gameId)
      await loadData()
    } catch (err: any) {
      alert('Failed to delete game: ' + err.message)
    }
  }

  const toggleGame = (gameId: number) => {
    const newSelected = new Set(selectedGames)
    if (newSelected.has(gameId)) {
      newSelected.delete(gameId)
    } else {
      newSelected.add(gameId)
    }
    setSelectedGames(newSelected)
  }

  const toggleAll = () => {
    if (selectedGames.size === games.length) {
      setSelectedGames(new Set())
    } else {
      setSelectedGames(new Set(games.map(g => g.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedGames.size === 0) return

    if (!confirm(`Are you sure you want to delete ${selectedGames.size} game(s)? This cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    try {
      await api.season.bulkDeleteGames(Number(seasonId!), Array.from(selectedGames))
      await loadData()
    } catch (err: any) {
      alert('Failed to delete games: ' + err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleResetGames = async () => {
    if (games.length === 0) {
      alert('No games to reset')
      return
    }

    if (!confirm(`Are you sure you want to RESET and delete ALL ${games.length} game(s)? This cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    try {
      await api.season.resetGames(Number(seasonId!))
      setShowSeedingForm(true) // Show seeding form again after reset
      await loadData()
    } catch (err: any) {
      alert('Failed to reset games: ' + err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleGenerateGames = async () => {
    setError('')

    // Validate all seeds are entered
    for (let i = 1; i <= 7; i++) {
      if (!afcSeeds[i] || !nfcSeeds[i]) {
        setError(`Please enter all 7 seeds for both AFC and NFC`)
        return
      }
    }

    if (!confirm('This will generate all playoff games based on the entered seeds. Any existing games will be deleted. Continue?')) {
      return
    }

    setIsGenerating(true)
    try {
      const seeds = [
        ...Array.from({ length: 7 }, (_, i) => ({
          conference: 'AFC',
          seed: i + 1,
          team_abbr: afcSeeds[i + 1]
        })),
        ...Array.from({ length: 7 }, (_, i) => ({
          conference: 'NFC',
          seed: i + 1,
          team_abbr: nfcSeeds[i + 1]
        }))
      ]

      await api.season.setSeeds(Number(seasonId!), seeds)
      await loadData()
      alert('Playoff games generated successfully!')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  const groupedGames = {
    wild_card: games.filter((g) => g.round === 'wild_card'),
    divisional: games.filter((g) => g.round === 'divisional'),
    conference: games.filter((g) => g.round === 'conference'),
    super_bowl: games.filter((g) => g.round === 'super_bowl'),
  }

  return (
    <div className="container">
      <div className="card">
        <Link to="/admin" className="link" style={{ color: '#667eea', marginBottom: '1rem', display: 'block' }}>
          ← Back to Dashboard
        </Link>

        <h2>{season?.name || 'Season Management'}</h2>
        <p style={{ color: '#718096', marginBottom: '1rem' }}>
          Season ID: {seasonId} | Year: {season?.year} | Status: {season?.status}
        </p>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <button onClick={handleUpdateScores} className="btn btn-primary" disabled={updating}>
            {updating ? 'Updating...' : 'Update Scores from ESPN'}
          </button>
          <button
            onClick={() => {
              setShowTeamEditor(!showTeamEditor)
              if (!showTeamEditor) loadTeams()
            }}
            className="btn btn-secondary"
          >
            {showTeamEditor ? 'Hide Team Editor' : 'Edit Team Names'}
          </button>
        </div>
      </div>

      {showTeamEditor && (
        <div className="card">
          <h3>Edit Team Names</h3>
          <p style={{ color: '#718096', marginBottom: '1rem', fontSize: '0.875rem' }}>
            Fix typos in team names. Changes will update all games, seeds, and predictions for this season.
          </p>

          {teams.length === 0 ? (
            <p style={{ color: '#a0aec0', fontStyle: 'italic' }}>No teams found. Add games or seeds first.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {teams.map(team => (
                <div
                  key={team}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#f7fafc',
                    borderRadius: '0.375rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {editingTeam === team ? (
                    <>
                      <input
                        type="text"
                        className="input"
                        value={newTeamName}
                        onChange={e => setNewTeamName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameTeam(team)
                          if (e.key === 'Escape') {
                            setEditingTeam(null)
                            setNewTeamName('')
                          }
                        }}
                        autoFocus
                        style={{ flex: 1, padding: '0.375rem 0.5rem', fontSize: '0.875rem' }}
                        disabled={isRenaming}
                      />
                      <button
                        onClick={() => handleRenameTeam(team)}
                        className="btn btn-primary"
                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                        disabled={isRenaming}
                      >
                        {isRenaming ? '...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingTeam(null)
                          setNewTeamName('')
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                        disabled={isRenaming}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontWeight: 500 }}>{team}</span>
                      <button
                        onClick={() => {
                          setEditingTeam(team)
                          setNewTeamName(team)
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showSeedingForm && (
        <div className="card">
          <h3>Playoff Seeding</h3>
          <p style={{ color: '#718096', marginBottom: '1.5rem' }}>
            Enter the playoff seeds for each conference. The system will auto-generate all playoff games based on NFL rules.
            Seeds #1 and #2 get first-round byes.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            {/* AFC Seeds */}
            <div>
              <h4 style={{ marginBottom: '1rem', color: '#4a5568' }}>AFC</h4>
              {[1, 2, 3, 4, 5, 6, 7].map(seed => (
                <div key={seed} className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>#{seed} Seed</label>
                  <input
                    type="text"
                    className="input"
                    value={afcSeeds[seed] || ''}
                    onChange={e => setAfcSeeds({ ...afcSeeds, [seed]: e.target.value })}
                    placeholder={`e.g., ${seed === 1 ? 'Chiefs' : seed === 2 ? 'Bills' : seed === 3 ? 'Ravens' : 'Texans'}`}
                    style={{ padding: '0.5rem' }}
                  />
                </div>
              ))}
            </div>

            {/* NFC Seeds */}
            <div>
              <h4 style={{ marginBottom: '1rem', color: '#4a5568' }}>NFC</h4>
              {[1, 2, 3, 4, 5, 6, 7].map(seed => (
                <div key={seed} className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>#{seed} Seed</label>
                  <input
                    type="text"
                    className="input"
                    value={nfcSeeds[seed] || ''}
                    onChange={e => setNfcSeeds({ ...nfcSeeds, [seed]: e.target.value })}
                    placeholder={`e.g., ${seed === 1 ? 'Eagles' : seed === 2 ? '49ers' : seed === 3 ? 'Lions' : 'Buccaneers'}`}
                    style={{ padding: '0.5rem' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

          <button
            onClick={handleGenerateGames}
            className="btn btn-primary"
            disabled={isGenerating}
            style={{ width: '100%', padding: '0.75rem' }}
          >
            {isGenerating ? 'Generating Games...' : 'Generate Playoff Games'}
          </button>
        </div>
      )}

      {!showSeedingForm && (
        <div className="card">
          <h3>Add New Game (Manual)</h3>
          <p style={{ color: '#718096', marginBottom: '1rem', fontSize: '0.875rem' }}>
            Games were auto-generated from seeding. You can manually add additional games here if needed.
          </p>
          <form onSubmit={handleAddGame}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label>Round</label>
              <select className="select" value={round} onChange={(e) => setRound(e.target.value as Game['round'])}>
                <option value="wild_card">Wild Card</option>
                <option value="divisional">Divisional</option>
                <option value="conference">Conference Championship</option>
                <option value="super_bowl">Super Bowl</option>
              </select>
            </div>

            <div className="form-group">
              <label>Home Team</label>
              <input
                ref={homeTeamInputRef}
                type="text"
                className="input"
                value={teamHome}
                onChange={(e) => setTeamHome(e.target.value)}
                placeholder="e.g., KC"
                required
              />
            </div>

            <div className="form-group">
              <label>Away Team</label>
              <input
                type="text"
                className="input"
                value={teamAway}
                onChange={(e) => setTeamAway(e.target.value)}
                placeholder="e.g., BUF"
                required
              />
            </div>
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" className="btn btn-primary">
            Add Game
          </button>
        </form>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0 }}>Playoff Games</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {games.length > 0 && (
              <>
                <button
                  onClick={toggleAll}
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 1rem' }}
                >
                  {selectedGames.size === games.length ? 'Deselect All' : 'Select All'}
                </button>
                {selectedGames.size > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                    className="btn btn-danger"
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    {isDeleting ? 'Deleting...' : `Delete Selected (${selectedGames.size})`}
                  </button>
                )}
                <button
                  onClick={handleResetGames}
                  disabled={isDeleting}
                  className="btn btn-danger"
                  style={{ padding: '0.5rem 1rem' }}
                >
                  {isDeleting ? 'Resetting...' : 'Reset All Games'}
                </button>
              </>
            )}
          </div>
        </div>

        {Object.entries(groupedGames).map(([roundName, roundGames]) => {
          if (roundGames.length === 0) return null

          return (
            <div key={roundName} style={{ marginBottom: '2rem' }}>
              <h4 style={{ textTransform: 'capitalize', marginBottom: '1rem', color: '#4a5568' }}>
                {roundName.replace('_', ' ')}
              </h4>
              <div className="grid">
                {roundGames.map((game) => (
                  <div key={game.id} className={`game-card ${game.completed ? 'completed' : ''}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '0.875rem', color: '#a0aec0' }}>
                        Game {game.game_number}
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedGames.has(game.id)}
                        onChange={() => toggleGame(game.id)}
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                    </div>
                    <div className="teams">
                      <span className={`team ${game.winner === game.team_home ? 'winner' : ''}`}>
                        {game.team_home}
                      </span>
                      <span className="vs">vs</span>
                      <span className={`team ${game.winner === game.team_away ? 'winner' : ''}`}>
                        {game.team_away}
                      </span>
                    </div>

                    {!!game.completed && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <span className="badge badge-success">Winner: {game.winner}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                      <button
                        onClick={() => handleManualWinner(game.id, game.team_home)}
                        className="btn btn-secondary"
                        style={{ flex: 1, padding: '0.5rem', fontSize: '0.875rem' }}
                      >
                        {game.team_home} Win
                      </button>
                      <button
                        onClick={() => handleManualWinner(game.id, game.team_away)}
                        className="btn btn-secondary"
                        style={{ flex: 1, padding: '0.5rem', fontSize: '0.875rem' }}
                      >
                        {game.team_away} Win
                      </button>
                    </div>

                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
                      <button
                        onClick={() => handleDeleteGame(game.id)}
                        className="btn btn-danger"
                        style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                      >
                        Delete Game
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {games.length === 0 && (
          <p style={{ textAlign: 'center', color: '#a0aec0', padding: '2rem' }}>
            No games added yet. Add games using the form above.
          </p>
        )}
      </div>
    </div>
  )
}

export default SeasonManagement
