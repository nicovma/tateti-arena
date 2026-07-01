import { create } from 'zustand'
import api from '../api/axios'

interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
  wins: number
  losses: number
  draws: number
  match_history: MatchHistoryItem[]
}

interface MatchHistoryItem {
  game_id: string
  opponent: string
  result: 'WIN' | 'LOSS' | 'DRAW'
  date: string
}

interface AuthStore {
  user: User | null
  jwt: string | null
  isAuthenticated: boolean
  login: (googleToken: string) => Promise<void>
  logout: () => void
  loadProfile: () => Promise<void>
}

const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  jwt: localStorage.getItem('jwt'),
  isAuthenticated: !!localStorage.getItem('jwt'),

  login: async (googleToken) => {
    const { data } = await api.post('/auth/google', { token: googleToken })
    localStorage.setItem('jwt', data.jwt)
    set({ jwt: data.jwt, user: { ...data.user, wins: 0, losses: 0, draws: 0, match_history: [] }, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('jwt')
    localStorage.removeItem('game_id')
    set({ jwt: null, user: null, isAuthenticated: false })
  },

  loadProfile: async () => {
    const { data } = await api.get('/profile/stats')
    set({ user: data })
  },
}))

export default useAuthStore
