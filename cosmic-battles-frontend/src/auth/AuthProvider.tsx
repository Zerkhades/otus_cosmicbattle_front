import { createContext, useContext, useEffect, useState } from 'react'
import { User, WebStorageStateStore } from 'oidc-client-ts'
import { userManager } from './userManager'

interface AuthCtx { 
  user: User | null; 
  login: () => void; 
  logout: () => void; 
}

const Ctx = createContext<AuthCtx>(null!)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    userManager.events.addUserLoaded(setUser)
    userManager.events.addUserUnloaded(() => setUser(null))
    userManager.getUser().then(u => setUser(u))
  }, [])

  return (
    <Ctx.Provider
      value={{
        user,
        login: () => userManager.signinRedirect(),
        logout: () => userManager.signoutRedirect(),
      }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
