import { create } from 'zustand'
import { getSocket, disconnectSocket } from '../socket/socket'
import useUiStore from './uiStore'

type GameStatus = 'idle' | 'waiting' | 'playing' | 'finished'

interface Message {
  sender: string
  text: string
}

interface GameStore {
  gameId: string | null
  board: string[]
  mySymbol: 'X' | 'O' | null
  currentTurn: 'X' | 'O'
  status: GameStatus
  opponent: string | null
  messages: Message[]
  winnerId: string | null
  connectSocket: (jwt: string) => void
  findMatch: () => void
  makeMove: (position: number) => void
  sendMessage: (text: string) => void
  rejoinIfNeeded: () => void
  resetGame: () => void
  disconnect: () => void
}

const useGameStore = create<GameStore>((set, get) => ({
  gameId: null,
  board: Array(9).fill(' '),
  mySymbol: null,
  currentTurn: 'X',
  status: 'idle',
  opponent: null,
  messages: [],
  winnerId: null,

  connectSocket: (jwt) => {
    const socket = getSocket(jwt)

    socket.on('waiting', () => set({ status: 'waiting' }))

    socket.on('game_start', ({ game_id, symbol, opponent }: { game_id: string; symbol: 'X' | 'O'; opponent: string }) => {
      localStorage.setItem('game_id', game_id)
      set({
        gameId: game_id,
        mySymbol: symbol,
        opponent,
        status: 'playing',
        board: Array(9).fill(' '),
        currentTurn: 'X',
        messages: [],
        winnerId: null,
      })
    })

    socket.on('board_update', ({ board, next_turn }: { board: string; next_turn: 'X' | 'O' }) => {
      set({ board: board.split(''), currentTurn: next_turn })
    })

    socket.on('game_over', ({ winner_id, board }: { winner_id: string | null; board: string }) => {
      localStorage.removeItem('game_id')
      set({ board: board.split(''), status: 'finished', winnerId: winner_id })
    })

    socket.on('chat_message', ({ sender, text }: { sender: string; text: string }) => {
      set((s) => ({ messages: [...s.messages, { sender, text }] }))
    })

    socket.on('game_rejoined', ({ game_id, symbol, board, current_turn, opponent }: {
      game_id: string; symbol: 'X' | 'O'; board: string; current_turn: 'X' | 'O'; opponent: string
    }) => {
      set({
        gameId: game_id,
        mySymbol: symbol,
        board: board.split(''),
        currentTurn: current_turn,
        opponent,
        status: 'playing',
      })
    })

    socket.on('opponent_disconnected', () => {
      useUiStore.getState().addToast('Your opponent disconnected', 'warning')
    })

    socket.on('connect_error', (err: Error) => {
      useUiStore.getState().addToast(`Connection error: ${err.message}`, 'error')
    })

    socket.connect()
  },

  findMatch: () => {
    const socket = getSocket()
    socket.emit('find_match', {})
    set({ status: 'waiting' })
  },

  makeMove: (position) => {
    const { gameId, mySymbol, currentTurn, board } = get()
    if (mySymbol !== currentTurn || board[position] !== ' ') return
    const socket = getSocket()
    socket.emit('make_move', { game_id: gameId, position })
  },

  sendMessage: (text) => {
    const { gameId } = get()
    const socket = getSocket()
    socket.emit('send_message', { game_id: gameId, text })
  },

  rejoinIfNeeded: () => {
    const savedGameId = localStorage.getItem('game_id')
    if (savedGameId) {
      const socket = getSocket()
      socket.emit('rejoin_game', { game_id: savedGameId })
    }
  },

  resetGame: () => {
    localStorage.removeItem('game_id')
    set({
      gameId: null,
      board: Array(9).fill(' '),
      mySymbol: null,
      currentTurn: 'X',
      status: 'idle',
      opponent: null,
      messages: [],
      winnerId: null,
    })
  },

  disconnect: () => {
    disconnectSocket()
    set({ status: 'idle' })
  },
}))

export default useGameStore
