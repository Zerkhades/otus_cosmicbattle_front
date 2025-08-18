import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import router from './router'
import { AuthProvider } from './auth/AuthProvider'
import './index.css'
import { Toaster } from 'sonner'
import NotificationToast from './components/NotificationToast' // <— добавь

const qc = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <AuthProvider>
      <RouterProvider router={router} />
      <NotificationToast />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  </QueryClientProvider>
)
