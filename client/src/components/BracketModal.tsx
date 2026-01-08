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

  const renderGameCard = (game: BracketGame, compact: boolean = false) => {
    const style = getPickStyle(game)
    const icon = getPickIcon(game)
    const prediction = game.prediction?.predictedWinner || 'No pick'

    return (
      <div
        key={game.id}
        style={{
          ...style,
          border: '2px solid',
          borderRadius: '6px',
          padding: compact ? '0.5rem' : '0.75rem',
          marginBottom: '0.5rem',
          minWidth: compact ? '100px' : '140px',
        }}
      >
        <div style={{ fontSize: compact ? '0.6875rem' : '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>
          {game.teamHome} vs {game.teamAway}
        </div>
        <div style={{ fontWeight: 600, fontSize: compact ? '0.8125rem' : '0.875rem' }}>
          {prediction}{icon}
        </div>
        {game.completed && game.winner && (
          <div style={{ fontSize: compact ? '0.625rem' : '0.6875rem', color: '#718096', marginTop: '0.25rem' }}>
            Winner: {game.winner}
          </div>
        )}
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
          <div style={{ flex: 1 }}>
            <h3 style={{ textAlign: 'center', color: '#667eea', marginBottom: '1rem', fontSize: '1.125rem' }}>AFC</h3>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              {/* Wild Card */}
              <div>
                {renderRoundLabel('Wild Card')}
                {afc.wildCard.map(g => renderGameCard(g))}
              </div>

              {/* Divisional */}
              <div>
                {renderRoundLabel('Divisional')}
                {afc.divisional.map(g => renderGameCard(g))}
              </div>

              {/* Conference */}
              <div>
                {renderRoundLabel('Conference')}
                {afc.conference.map(g => renderGameCard(g))}
              </div>
            </div>
          </div>

          {/* Super Bowl Center */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 1rem' }}>
            {renderRoundLabel('Super Bowl')}
            {superBowl && renderGameCard(superBowl)}
          </div>

          {/* NFC Side */}
          <div style={{ flex: 1 }}>
            <h3 style={{ textAlign: 'center', color: '#e53e3e', marginBottom: '1rem', fontSize: '1.125rem' }}>NFC</h3>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexDirection: 'row-reverse' }}>
              {/* Wild Card */}
              <div>
                {renderRoundLabel('Wild Card')}
                {nfc.wildCard.map(g => renderGameCard(g))}
              </div>

              {/* Divisional */}
              <div>
                {renderRoundLabel('Divisional')}
                {nfc.divisional.map(g => renderGameCard(g))}
              </div>

              {/* Conference */}
              <div>
                {renderRoundLabel('Conference')}
                {nfc.conference.map(g => renderGameCard(g))}
              </div>
            </div>
          </div>
        </div>

        {/* Bracket Content - Mobile */}
        <div className="bracket-mobile" style={bracketMobileStyle}>
          {/* Super Bowl */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ textAlign: 'center', color: '#667eea', marginBottom: '0.75rem', fontSize: '1.125rem' }}>Super Bowl</h3>
            {superBowl && renderGameCard(superBowl, true)}
          </div>

          {/* Conference */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h4 style={{ textAlign: 'center', color: '#667eea', marginBottom: '0.5rem', fontSize: '0.875rem' }}>AFC Conference</h4>
              {afc.conference.map(g => renderGameCard(g, true))}
            </div>
            <div>
              <h4 style={{ textAlign: 'center', color: '#e53e3e', marginBottom: '0.5rem', fontSize: '0.875rem' }}>NFC Conference</h4>
              {nfc.conference.map(g => renderGameCard(g, true))}
            </div>
          </div>

          {/* Divisional */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h4 style={{ textAlign: 'center', color: '#667eea', marginBottom: '0.5rem', fontSize: '0.875rem' }}>AFC Divisional</h4>
              {afc.divisional.map(g => renderGameCard(g, true))}
            </div>
            <div>
              <h4 style={{ textAlign: 'center', color: '#e53e3e', marginBottom: '0.5rem', fontSize: '0.875rem' }}>NFC Divisional</h4>
              {nfc.divisional.map(g => renderGameCard(g, true))}
            </div>
          </div>

          {/* Wild Card */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <h4 style={{ textAlign: 'center', color: '#667eea', marginBottom: '0.5rem', fontSize: '0.875rem' }}>AFC Wild Card</h4>
              {afc.wildCard.map(g => renderGameCard(g, true))}
            </div>
            <div>
              <h4 style={{ textAlign: 'center', color: '#e53e3e', marginBottom: '0.5rem', fontSize: '0.875rem' }}>NFC Wild Card</h4>
              {nfc.wildCard.map(g => renderGameCard(g, true))}
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
  maxWidth: '1100px',
  maxHeight: '90vh',
  overflowY: 'auto',
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
  padding: '1.5rem',
  gap: '0.5rem',
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
