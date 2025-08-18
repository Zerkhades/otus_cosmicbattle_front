import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

export default function Navbar() {
  const { user, logout } = useAuth()
  
  return (
    <nav className="w-full bg-gray-800 text-white p-2 flex justify-between">
      <div>
        <Link to="/" className="mr-4">🏠 Dashboard</Link>
        <Link to="/game" className="mr-4">Игра</Link>
        <Link to="/tournaments">Турниры</Link>
      </div>
      {user && (
        <div>
          <span className="mr-4">{user.profile?.preferred_username}</span>
          <button onClick={logout}>Выйти</button>
        </div>
      )}
    </nav>
  )
}
