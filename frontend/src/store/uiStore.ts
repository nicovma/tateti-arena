import { create } from 'zustand'

interface Toast {
  id: number
  message: string
  severity: 'success' | 'error' | 'warning' | 'info'
}

interface UiStore {
  toasts: Toast[]
  addToast: (message: string, severity?: Toast['severity']) => void
  removeToast: (id: number) => void
}

const useUiStore = create<UiStore>((set) => ({
  toasts: [],

  addToast: (message, severity = 'info') => {
    const id = Date.now()
    set((s) => ({ toasts: [...s.toasts, { id, message, severity }] }))
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

export default useUiStore
