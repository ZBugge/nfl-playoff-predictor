import { Link } from 'react-router-dom'

function Home() {
  return (
    <div className="container">
      <div className="home-container">
        <h1 className="home-hero-title">
          NFL Playoff Predictor
        </h1>
        <p className="home-hero-subtitle">
          Compete with friends to see who's the best at predicting NFL playoff games
        </p>

        <div className="grid grid-2" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="card">
            <h2>For Admins</h2>
            <p style={{ marginBottom: '1.5rem', color: '#718096' }}>
              Create a lobby, set up games, and invite your friends to compete
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
              <Link to="/login" className="btn btn-primary" style={{ textDecoration: 'none', textAlign: 'center' }}>
                Login
              </Link>
              <Link to="/register" className="btn btn-secondary" style={{ textDecoration: 'none', textAlign: 'center' }}>
                Register
              </Link>
            </div>
          </div>

          <div className="card">
            <h2>For Participants</h2>
            <p style={{ marginBottom: '1.5rem', color: '#718096' }}>
              Got an invite link? Join a lobby and make your predictions
            </p>
            <div style={{ marginTop: '2.5rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#a0aec0' }}>
                Click on the invite link sent to you by the lobby admin
              </p>
            </div>
          </div>
        </div>

        <div className="card" style={{ maxWidth: '800px', margin: '3rem auto' }}>
          <h3>How It Works</h3>
          <div style={{ textAlign: 'left' }}>
            <ol style={{ paddingLeft: '1.5rem', color: '#4a5568', lineHeight: '2' }}>
              <li>Admin creates a lobby and sets up playoff games</li>
              <li>Admin shares the invite link with friends</li>
              <li>Participants submit their predictions for all games</li>
              <li>Admin updates scores (automatically from ESPN or manually)</li>
              <li>Track who's winning on the live leaderboard</li>
              <li>Winner is crowned after the Super Bowl!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
