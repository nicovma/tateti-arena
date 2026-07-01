import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, CircularProgress,
  AppBar, Toolbar, IconButton,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import useGameStore from '../store/gameStore'
import useAuthStore from '../store/authStore'
import Board from '../components/Board'
import ChatBox from '../components/ChatBox'

export default function GamePage() {
  const {
    board, mySymbol, currentTurn, status, opponent,
    messages, winnerId, makeMove, sendMessage,
    connectSocket, rejoinIfNeeded, resetGame, disconnect,
  } = useGameStore()
  const { user, jwt } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (status === 'idle' && jwt) {
      const savedGameId = localStorage.getItem('game_id')
      if (savedGameId) {
        connectSocket(jwt)
        rejoinIfNeeded()
      } else {
        navigate('/dashboard')
      }
    }
  }, [])

  const handleLeave = () => {
    disconnect()
    resetGame()
    navigate('/dashboard')
  }

  const isMyTurn = mySymbol === currentTurn
  const myName = user?.name ?? 'You'

  if (status === 'waiting') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 3 }}>
        <CircularProgress size={60} />
        <Typography variant="h6">Searching for opponent...</Typography>
        <Button variant="outlined" onClick={handleLeave}>Cancel</Button>
      </Box>
    )
  }

  if (status === 'finished') {
    let resultText = 'Draw!'
    if (winnerId) {
      resultText = winnerId === user?.id ? 'You won!' : 'You lost!'
    }
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 3, p: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>{resultText}</Typography>
        <Board board={board} onMove={() => {}} disabled={true} />
        <Button variant="contained" size="large" onClick={handleLeave}>
          Back to Dashboard
        </Button>
      </Box>
    )
  }

  if (status === 'playing') {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
        <AppBar position="static">
          <Toolbar>
            <IconButton color="inherit" onClick={handleLeave} sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h6">vs {opponent}</Typography>
          </Toolbar>
        </AppBar>

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'center', md: 'flex-start' },
            justifyContent: 'center',
            gap: 4,
            p: { xs: 2, md: 6 },
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Typography variant="body1">
              You play as <strong>{mySymbol}</strong> · Opponent ({opponent}): <strong>{mySymbol === 'X' ? 'O' : 'X'}</strong>
            </Typography>
            <Typography variant="body2" sx={{ color: isMyTurn ? 'success.main' : 'text.secondary', fontWeight: 'bold' }}>
              {isMyTurn ? 'Your turn' : `${opponent}'s turn`}
            </Typography>
            <Board board={board} onMove={makeMove} disabled={!isMyTurn} />
          </Box>

          <ChatBox messages={messages} onSend={sendMessage} myName={myName} />
        </Box>
      </Box>
    )
  }

  return null
}
