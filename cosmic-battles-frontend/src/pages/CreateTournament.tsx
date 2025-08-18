import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createTournament } from '../api/tournament'
import { useNavigate } from 'react-router-dom'

export default function CreateTournament() {
  const [name, setName] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [startsAt, setStartsAt] = useState('')
  
  const qc = useQueryClient()
  const navigate = useNavigate()
  
  const mutation = useMutation({
    mutationFn: createTournament,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['upcoming'] })
      navigate('/tournaments')
    }
  })
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({
      name,
      maxPlayers,
      startsAt: new Date(startsAt).toISOString()
    })
  }
  
  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Создать турнир</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Название</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Макс. игроков</label>
          <input
            type="number"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
            min="2"
            max="32"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Начало</label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full bg-blue-500 text-white py-2 rounded disabled:opacity-50"
        >
          {mutation.isPending ? 'Создание...' : 'Создать'}
        </button>
      </form>
    </div>
  )
}
