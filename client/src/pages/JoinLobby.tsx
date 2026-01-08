import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, type Lobby, type Game } from '../api/api'

function JoinLobby() {
  const { lobbyId } = useParams<{ lobbyId: string }>()
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const [name, setName] = useState('')
  const [predictions, setPredictions] = useState<Record<number, { winner: string; opponent: string }>>({})
  const [seeds, setSeeds] = useState<Array<{ conference: string; seed: number; team_abbr: string }>>([])

  useEffect(() => {
    loadData()
  }, [lobbyId])

  const loadData = async () => {
    try {
      const [lobbyData, gamesData] = await Promise.all([
        api.lobby.getById(lobbyId!),
        api.lobby.getGames(lobbyId!),
      ])
      setLobby(lobbyData)
      setGames(gamesData)

      // Fetch seeds for the lobby's season
      if (lobbyData.season_id) {
        const seedsData = await api.season.getSeeds(lobbyData.season_id)
        setSeeds(seedsData)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Calculate dynamic matchups based on user's predictions
  const calculateDynamicMatchup = (game: Game, conference?: 'AFC' | 'NFC'): { home: string; away: string } => {
    // Wild Card games are static
    if (game.round === 'wild_card') {
      return { home: game.team_home, away: game.team_away }
    }

    // Super Bowl: AFC Conference winner vs NFC Conference winner
    if (game.round === 'super_bowl') {
      const confGames = games.filter(g => g.round === 'conference')
      const afcChamp = predictions[confGames[0]?.id]?.winner || 'TBD'
      const nfcChamp = predictions[confGames[1]?.id]?.winner || 'TBD'
      return { home: afcChamp, away: nfcChamp }
    }

    if (game.round === 'divisional') {
      // Get Wild Card games for this conference
      const wildCardGames = games.filter(g => g.round === 'wild_card')

      // Determine which Wild Card games belong to this conference (games 1-3 are AFC, 4-6 are NFC)
      const confWildCardGames = conference === 'AFC'
        ? wildCardGames.slice(0, 3)
        : wildCardGames.slice(3, 6)

      // Get winners and their seeds from user's predictions
      const winners = confWildCardGames
        .map(wcGame => {
          const prediction = predictions[wcGame.id]
          if (!prediction?.winner) return null

          // Determine seed of winner
          const winnerSeed = wcGame.team_home === prediction.winner
            ? wcGame.seed_home
            : wcGame.seed_away

          return { team: prediction.winner, seed: winnerSeed }
        })
        .filter(w => w !== null && w.seed !== null) as Array<{ team: string; seed: number }>

      // Add bye team (seed #1 only) from the seeds data
      const confSeeds = seeds.filter(s => s.conference === conference)
      const seed1 = confSeeds.find(s => s.seed === 1)

      const byeTeams: Array<{ team: string; seed: number }> = []
      if (seed1) byeTeams.push({ team: seed1.team_abbr, seed: 1 })

      // Sort all advancing teams by seed (lowest seed number = best team)
      const allTeams = [...byeTeams, ...winners].sort((a, b) => a.seed - b.seed)

      if (allTeams.length < 4) {
        // Not enough predictions yet (need 3 Wild Card winners + 1 bye team = 4 total)
        return { home: 'TBD', away: 'TBD' }
      }

      // Re-seed: #1 vs lowest remaining seed, then second-best vs second-worst
      if (game.game_number === 1 || game.game_number === 3) {
        // First divisional game for this conference
        return {
          home: allTeams[0]?.team || 'TBD',
          away: allTeams[allTeams.length - 1]?.team || 'TBD'
        }
      } else {
        // Second divisional game for this conference
        return {
          home: allTeams[1]?.team || 'TBD',
          away: allTeams[allTeams.length - 2]?.team || 'TBD'
        }
      }
    }

    if (game.round === 'conference') {
      // Simple: Winner of Div Game 1 vs Winner of Div Game 2 for this conference
      const divGames = games.filter(g => g.round === 'divisional')
      const confDivGames = conference === 'AFC'
        ? divGames.slice(0, 2)
        : divGames.slice(2, 4)

      const game1Winner = predictions[confDivGames[0]?.id]?.winner || 'TBD'
      const game2Winner = predictions[confDivGames[1]?.id]?.winner || 'TBD'

      return { home: game1Winner, away: game2Winner }
    }

    return { home: game.team_home, away: game.team_away }
  }

  const handlePredictionChange = (gameId: number, winner: string, opponent: string) => {
    setPredictions({ ...predictions, [gameId]: { winner, opponent } })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Please enter your name')
      return
    }

    const allPredicted = games.every((game) => predictions[game.id])
    if (!allPredicted) {
      setError('Please make a prediction for all games')
      return
    }

    try {
      const predictionArray = Object.entries(predictions).map(([gameId, pred]) => ({
        gameId: Number(gameId),
        predictedWinner: pred.winner,
        predictedOpponent: pred.opponent,
      }))

      await api.participant.submit(lobbyId!, name, predictionArray)
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (submitted) {
    return (
      <div className="container">
        <div style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center' }}>
          <div className="card">
            <h2 style={{ color: '#48bb78' }}>Predictions Submitted!</h2>
            <p style={{ fontSize: '1.125rem', marginBottom: '2rem', color: '#718096' }}>
              Thanks for participating, {name}! Your predictions have been saved.
            </p>
            <Link
              to={`/leaderboard/${lobbyId}`}
              className="btn btn-primary"
              style={{ textDecoration: 'none', display: 'inline-block' }}
            >
              View Leaderboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const groupedGames = {
    wild_card: games.filter((g) => g.round === 'wild_card'),
    divisional: games.filter((g) => g.round === 'divisional'),
    conference: games.filter((g) => g.round === 'conference'),
    super_bowl: games.filter((g) => g.round === 'super_bowl'),
  }

  return (
    <div className="container">
      <div className="join-lobby-container">
        <h1>Join {lobby?.name}</h1>

        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <Link
            to={`/leaderboard/${lobbyId}`}
            className="btn btn-secondary"
            style={{ textDecoration: 'none' }}
          >
            View Leaderboard
          </Link>
        </div>

        <div className="card">
          <p style={{ fontSize: '1.125rem', marginBottom: '1.5rem', color: '#4a5568' }}>
            Make your predictions for all playoff games. Once submitted, you can view the leaderboard to see how you stack up!
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Your Name</label>
              <input
                id="name"
                type="text"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
              />
            </div>

            <h3>Make Your Predictions</h3>

            {Object.entries(groupedGames).map(([roundName, roundGames]) => {
              if (roundGames.length === 0) return null

              const isPostWildcard = roundName !== 'wild_card'

              return (
                <div key={roundName} style={{ marginBottom: '2rem' }}>
                  <h4 style={{ textTransform: 'capitalize', marginBottom: '0.5rem', color: '#667eea' }}>
                    {roundName.replace('_', ' ')}
                  </h4>
                  {isPostWildcard && (
                    <div className="bracket-info-alert">
                      ℹ️ <strong>Dynamic Bracket:</strong> These matchups update automatically based on your Wild Card predictions!
                      You'll earn full points for each correct winner prediction.
                    </div>
                  )}
                  <div className="grid">
                    {roundGames.map((game) => {
                      // Determine conference based on game number
                      const conference: 'AFC' | 'NFC' = (
                        (roundName === 'divisional' && (game.game_number <= 2)) ||
                        (roundName === 'conference' && game.game_number === 1) ||
                        (roundName === 'wild_card' && game.game_number <= 3)
                      ) ? 'AFC' : 'NFC'

                      // Calculate dynamic matchup for post-Wild Card rounds
                      const dynamicMatchup = roundName !== 'wild_card'
                        ? calculateDynamicMatchup(game, conference)
                        : null

                      const homeTeam = dynamicMatchup?.home || game.team_home
                      const awayTeam = dynamicMatchup?.away || game.team_away
                      const opponentForHome = awayTeam
                      const opponentForAway = homeTeam

                      return (
                        <div key={game.id} className="game-card">
                          <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: '#a0aec0' }}>
                            Game {game.game_number}
                            {game.seed_home && game.seed_away && (
                              <span style={{ marginLeft: '0.5rem' }}>
                                (#{game.seed_home} vs #{game.seed_away})
                              </span>
                            )}
                          </div>
                          <div className="teams" style={{ marginBottom: '1rem' }}>
                            <span className="team">{homeTeam}</span>
                            <span className="vs">vs</span>
                            <span className="team">{awayTeam}</span>
                          </div>


                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.875rem', marginBottom: '0.5rem', display: 'block', fontWeight: 600 }}>
                              Pick Winner:
                            </label>
                            <div className="game-card-prediction-buttons">
                              <button
                                type="button"
                                onClick={() => handlePredictionChange(game.id, homeTeam, opponentForHome)}
                                className={`btn prediction-button ${
                                  predictions[game.id]?.winner === homeTeam ? 'btn-primary' : 'btn-secondary'
                                }`}
                              >
                                {homeTeam}
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePredictionChange(game.id, awayTeam, opponentForAway)}
                                className={`btn prediction-button ${
                                  predictions[game.id]?.winner === awayTeam ? 'btn-primary' : 'btn-secondary'
                                }`}
                              >
                                {awayTeam}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {games.length === 0 && (
              <p style={{ textAlign: 'center', color: '#a0aec0', padding: '2rem' }}>
                No games have been set up yet. Check back later!
              </p>
            )}

            {error && <div className="error">{error}</div>}

            {games.length > 0 && (
              <button type="submit" className="btn btn-primary submit-button">
                Submit Predictions
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

export default JoinLobby
