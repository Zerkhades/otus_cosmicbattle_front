import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Callback from './pages/Callback'
import Dashboard from './pages/Dashboard'
import Tournaments from './pages/Tournaments'
import CreateTournament from './pages/CreateTournament'
import TournamentDetails from './pages/TournamentDetails'
import BattleSpectator from './pages/BattleSpectator'
import Game from './pages/Game';

function Protected({ element }: { element: JSX.Element }) {
  const { user } = useAuth()
  return user ? element : <Navigate to="/login" replace />
}

function Layout() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  )
}

export default createBrowserRouter([
  {
    path: '/', 
    element: <Layout />, 
    children: [
      { index: true, element: <Protected element={<Dashboard />} /> },
      { path: 'tournaments', element: <Protected element={<Tournaments />} /> },
      { path: 'tournaments/new', element: <Protected element={<CreateTournament />} /> },
      { path: 'tournaments/:id', element: <Protected element={<TournamentDetails />} /> },
      { path: 'battles/:id', element: <Protected element={<BattleSpectator />} /> },
      { path: 'game', element: <Protected element={<Game />} /> },
    ]
  },
  { path: '/login', element: <Login /> },
  { path: '/callback', element: <Callback /> }
])
