import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminDashboard from './pages/AdminDashboard'
import CreateLobby from './pages/CreateLobby'
import CreateSeason from './pages/CreateSeason'
import SeasonManagement from './pages/SeasonManagement'
import StatsPage from './pages/StatsPage'
import JoinLobby from './pages/JoinLobby'
import Leaderboard from './pages/Leaderboard'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/create-lobby" element={<CreateLobby />} />
        <Route path="/admin/create-season" element={<CreateSeason />} />
        <Route path="/admin/season/:seasonId" element={<SeasonManagement />} />
        <Route path="/admin/stats" element={<StatsPage />} />
        <Route path="/join/:lobbyId" element={<JoinLobby />} />
        <Route path="/leaderboard/:lobbyId" element={<Leaderboard />} />
      </Routes>
    </Router>
  )
}

export default App
