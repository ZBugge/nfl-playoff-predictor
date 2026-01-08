import { useState, useEffect } from 'react'
import { api, type BracketData, type BracketGame } from '../api/api'

interface BracketModalProps {
  participantId: number
  seasonId: number
  onClose: () => void
}

function BracketModal({ participantId, seasonId, onClose }: BracketModalProps) {
  const [bracketData, setBracketData] = useState<BracketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadBracket()
  }, [participantId, seasonId])

  const loadBracket = async () => {
    try {
      setLoading(true)
      const data = await api.participant.getBracket(participantId, seasonId)
      setBracketData(data)
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to load bracket')
    } finally {
      setLoading(false)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const getPickStyle = (game: BracketGame): React.CSSProperties => {
    if (!game.prediction) {
      return { backgroundColor: '#f7fafc', borderColor: '#e2e8f0' }
    }
    if (game.isCorrect === null) {
      return { backgroundColor: '#f7fafc', borderColor: '#a0aec0' }
    }
    if (game.isCorrect) {
      return { backgroundColor: '#c6f6d5', borderColor: '#48bb78' }
    }
    return { backgroundColor: '#fed7d7', borderColor: '#f56565' }
  }

  const getPickIcon = (game: BracketGame): string => {
    if (!game.prediction) return ''
    if (game.isCorrect === null) return ''
    return game.isCorrect ? ' \u2713' : ' \u2717'
  }

  // Organize games by conference and round
  const organizeGames = (games: BracketGame[]) => {
    const afc = {
      wildCard: games.filter(g => g.round === 'wild_card' && g.gameNumber <= 3),
      divisional: games.filter(g => g.round === 'divisional' && g.gameNumber <= 2),
      conference: games.filter(g => g.round === 'conference' && g.gameNumber === 1),
    }
    const nfc = {
      wildCard: games.filter(g => g.round === 'wild_card' && g.gameNumber >= 4),
      divisional: games.filter(g => g.round === 'divisional' && g.gameNumber >= 3),
      conference: games.filter(g => g.round === 'conference' && g.gameNumber === 2),
    }
    const superBowl = games.find(g => g.round === 'super_bowl')
    return { afc, nfc, superBowl }
  }

  // Reconstruct predicted matchup based on earlier predictions
  const getPredictedMatchup = (game: BracketGame, allGames: BracketGame[]): { home: string; away: string } => {
    // If actual matchup is set, use it
    if (game.teamHome && game.teamAway && game.teamHome !== 'TBD' && game.teamAway !== 'TBD') {
      return { home: game.teamHome, away: game.teamAway }
    }

    // For Super Bowl, use Conference Championship predictions
    if (game.round === 'super_bowl') {
      const confGames = allGames.filter(g => g.round === 'conference')
      const afcConf = confGames.find(g => g.gameNumber === 1)
      const nfcConf = confGames.find(g => g.gameNumber === 2)
      const afcChamp = afcConf?.prediction?.predictedWinner || 'TBD'
      const nfcChamp = nfcConf?.prediction?.predictedWinner || 'TBD'
      return { home: afcChamp, away: nfcChamp }
    }

    // For Conference Championship, use Divisional predictions
    if (game.round === 'conference') {
      const divGames = allGames.filter(g => g.round === 'divisional')
      if (game.gameNumber === 1) {
        // AFC Conference
        const afcDiv = divGames.filter(g => g.gameNumber <= 2)
        const team1 = afcDiv[0]?.prediction?.predictedWinner || 'TBD'
        const team2 = afcDiv[1]?.prediction?.predictedWinner || 'TBD'
        return { home: team1, away: team2 }
      } else {
        // NFC Conference
        const nfcDiv = divGames.filter(g => g.gameNumber >= 3)
        const team1 = nfcDiv[0]?.prediction?.predictedWinner || 'TBD'
        const team2 = nfcDiv[1]?.prediction?.predictedWinner || 'TBD'
        return { home: team1, away: team2 }
      }
    }

    // For Divisional, this is more complex (re-seeding) - fall back to stored prediction
    if (game.prediction) {
      return {
        home: game.prediction.predictedWinner,
        away: game.prediction.predictedOpponent || 'TBD'
      }
    }

    return { home: 'TBD', away: 'TBD' }
  }

  const renderGameCard = (game: BracketGame, allGames: BracketGame[], compact = false) => {
    const style = getPickStyle(game)
    const icon = getPickIcon(game)
    const predictionWinner = game.prediction?.predictedWinner || 'No pick'

    // Determine teams to display - reconstruct from earlier predictions if needed
    const matchup = getPredictedMatchup(game, allGames)
    const teamsDisplay = `${matchup.home} vs ${matchup.away}`

    return (
      <div
        key={game.id}
        style={{
          ...style,
          border: '2px solid',
          borderRadius: '6px',
          padding: compact ? '0.5rem' : '0.5rem 0.75rem',
          marginBottom: '0.5rem',
          minWidth: compact ? '90px' : '115px',
        }}
      >
        <div style={{ fontSize: compact ? '0.6875rem' : '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>
          {teamsDisplay}
        </div>
        <div style={{ fontWeight: 600, fontSize: compact ? '0.8125rem' : '0.875rem' }}>
          {predictionWinner}{icon}
        </div>
        {game.completed && game.winner ? (
          <div style={{ fontSize: compact ? '0.625rem' : '0.6875rem', color: '#718096', marginTop: '0.25rem' }}>
            Winner: {game.winner}
          </div>
        ) : null}
      </div>
    )
  }

  const renderRoundLabel = (label: string) => (
    <div style={{
      fontSize: '0.75rem',
      fontWeight: 600,
      color: '#4a5568',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: '0.5rem',
      textAlign: 'center',
    }}>
      {label}
    </div>
  )

  if (loading) {
    return (
      <div style={overlayStyle} onClick={handleOverlayClick}>
        <div style={modalStyle}>
          <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
            Loading bracket...
          </div>
        </div>
      </div>
    )
  }

  if (error || !bracketData) {
    return (
      <div style={overlayStyle} onClick={handleOverlayClick}>
        <div style={modalStyle}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ color: '#f56565', marginBottom: '1rem' }}>{error || 'Failed to load bracket'}</div>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    )
  }

  const { afc, nfc, superBowl } = organizeGames(bracketData.games)
  const accuracy = bracketData.stats.totalPicks > 0
    ? ((bracketData.stats.correctPicks / bracketData.stats.totalPicks) * 100).toFixed(1)
    : '0.0'

  return (
    <div style={overlayStyle} onClick={handleOverlayClick}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div>
            <h2 style={{ margin: 0, color: '#2d3748', fontSize: '1.5rem' }}>
              {bracketData.participant.name}
            </h2>
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#718096' }}>
              Score: <strong style={{ color: '#667eea' }}>{bracketData.stats.simpleScore}</strong>
              {' | '}
              Correct: <strong>{bracketData.stats.correctPicks}/{bracketData.stats.totalPicks}</strong>
              {' | '}
              Accuracy: <strong>{accuracy}%</strong>
            </div>
          </div>
          <button
            onClick={onClose}
            style={closeButtonStyle}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Legend */}
        <div style={legendStyle}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '12px', height: '12px', backgroundColor: '#c6f6d5', border: '1px solid #48bb78', borderRadius: '2px' }}></span>
            Correct
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '12px', height: '12px', backgroundColor: '#fed7d7', border: '1px solid #f56565', borderRadius: '2px' }}></span>
            Wrong
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '12px', height: '12px', backgroundColor: '#f7fafc', border: '1px solid #a0aec0', borderRadius: '2px' }}></span>
            Pending
          </span>
        </div>

        {/* Bracket Content - Desktop */}
        <div className="bracket-desktop" style={bracketDesktopStyle}>
          {/* AFC Side */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ textAlign: 'center', color: '#667eea', marginBottom: '0.75rem', fontSize: '1rem' }}>AFC</h3>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              {/* Wild Card */}
              <div>
                {renderRoundLabel('Wild Card')}
                {afc.wildCard.map(g => renderGameCard(g, bracketData.games))}
              </div>

              {/* Divisional */}
              <div>
                {renderRoundLabel('Divisional')}
                {afc.divisional.map(g => renderGameCard(g, bracketData.games))}
              </div>

              {/* Conference */}
              <div>
                {renderRoundLabel('Conference')}
                {afc.conference.map(g => renderGameCard(g, bracketData.games))}
              </div>
            </div>
          </div>

          {/* Super Bowl Center */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 0.5rem' }}>
            {renderRoundLabel('Super Bowl')}
            {superBowl && renderGameCard(superBowl, bracketData.games)}
          </div>

          {/* NFC Side */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ textAlign: 'center', color: '#e53e3e', marginBottom: '0.75rem', fontSize: '1rem' }}>NFC</h3>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexDirection: 'row-reverse' }}>
              {/* Wild Card */}
              <div>
                {renderRoundLabel('Wild Card')}
                {nfc.wildCard.map(g => renderGameCard(g, bracketData.games))}
              </div>

              {/* Divisional */}
              <div>
                {renderRoundLabel('Divisional')}
                {nfc.divisional.map(g => renderGameCard(g, bracketData.games))}
              </div>

              {/* Conference */}
              <div>
                {renderRoundLabel('Conference')}
                {nfc.conference.map(g => renderGameCard(g, bracketData.games))}
              </div>
            </div>
          </div>
        </div>

        {/* Bracket Content - Mobile */}
        <div className="bracket-mobile" style={bracketMobileStyle}>
          {/* Super Bowl */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ textAlign: 'center', color: '#667eea', marginBottom: '0.75rem', fontSize: '1.125rem' }}>Super Bowl</h3>
            {superBowl && renderGameCard(superBowl, bracketData.games, true)}
          </div>

          {/* Conference */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h4 style={{ textAlign: 'center', color: '#667eea', marginBottom: '0.5rem', fontSize: '0.875rem' }}>AFC Conference</h4>
              {afc.conference.map(g => renderGameCard(g, bracketData.games, true))}
            </div>
            <div>
              <h4 style={{ textAlign: 'center', color: '#e53e3e', marginBottom: '0.5rem', fontSize: '0.875rem' }}>NFC Conference</h4>
              {nfc.conference.map(g => renderGameCard(g, bracketData.games, true))}
            </div>
          </div>

          {/* Divisional */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h4 style={{ textAlign: 'center', color: '#667eea', marginBottom: '0.5rem', fontSize: '0.875rem' }}>AFC Divisional</h4>
              {afc.divisional.map(g => renderGameCard(g, bracketData.games, true))}
            </div>
            <div>
              <h4 style={{ textAlign: 'center', color: '#e53e3e', marginBottom: '0.5rem', fontSize: '0.875rem' }}>NFC Divisional</h4>
              {nfc.divisional.map(g => renderGameCard(g, bracketData.games, true))}
            </div>
          </div>

          {/* Wild Card */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <h4 style={{ textAlign: 'center', color: '#667eea', marginBottom: '0.5rem', fontSize: '0.875rem' }}>AFC Wild Card</h4>
              {afc.wildCard.map(g => renderGameCard(g, bracketData.games, true))}
            </div>
            <div>
              <h4 style={{ textAlign: 'center', color: '#e53e3e', marginBottom: '0.5rem', fontSize: '0.875rem' }}>NFC Wild Card</h4>
              {nfc.wildCard.map(g => renderGameCard(g, bracketData.games, true))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '1rem',
  overflowY: 'auto',
}

const modalStyle: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '12px',
  width: '100%',
  maxWidth: '1000px',
  maxHeight: '90vh',
  overflowY: 'auto',
  overflowX: 'hidden',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  padding: '1.5rem',
  borderBottom: '1px solid #e2e8f0',
  position: 'sticky',
  top: 0,
  backgroundColor: 'white',
  zIndex: 1,
}

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '2rem',
  cursor: 'pointer',
  color: '#718096',
  padding: '0',
  lineHeight: 1,
  width: '40px',
  height: '40px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '8px',
}

const legendStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1.5rem',
  justifyContent: 'center',
  padding: '0.75rem 1.5rem',
  backgroundColor: '#f7fafc',
  fontSize: '0.8125rem',
  color: '#4a5568',
  flexWrap: 'wrap',
}

const bracketDesktopStyle: React.CSSProperties = {
  display: 'flex',
  padding: '1rem',
  gap: '0.25rem',
  justifyContent: 'center',
}

const bracketMobileStyle: React.CSSProperties = {
  display: 'none',
  padding: '1rem',
}

// Add CSS for responsive display
const styleTag = document.createElement('style')
styleTag.textContent = `
  @media (max-width: 900px) {
    .bracket-desktop {
      display: none !important;
    }
    .bracket-mobile {
      display: block !important;
    }
  }
`
if (!document.head.querySelector('[data-bracket-modal-styles]')) {
  styleTag.setAttribute('data-bracket-modal-styles', 'true')
  document.head.appendChild(styleTag)
}

export default BracketModal
