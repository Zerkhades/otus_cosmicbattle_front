import { toast } from 'sonner'

export const useToast = () => ({ 
  push: (m: string) => toast(m) 
})
