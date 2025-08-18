import { useAuth } from '../auth/AuthProvider'

export default function Login() {
  const { login } = useAuth()
  
  return (
    <div className="h-screen flex items-center justify-center">
      <button className="btn" onClick={login}>
        Войти через IdentityServer
      </button>
    </div>
  )
}
