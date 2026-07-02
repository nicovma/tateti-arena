import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import useAuthStore from '../store/authStore'
import useGameStore from '../store/gameStore'
import StatsCard from '../components/StatsCard'
import useUiStore from '../store/uiStore'

export default function DashboardPage() {
  const { user, logout, loadProfile } = useAuthStore()
  const { connectSocket, findMatch } = useGameStore()
  const navigate = useNavigate()

  useEffect(() => {
      const params = new URLSearchParams(window.location.search)
      if (params.get('notify') === 'game_expired') {
        useUiStore.getState().addToast('Game session expired — please start a new match', 'warning')
        window.history.replaceState({}, '', '/dashboard')
      }
    loadProfile()
  }, [])

  const handleFindMatch = () => {
    const jwt = useAuthStore.getState().jwt!
    connectSocket(jwt)
    findMatch()
    navigate('/game')
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  if (!user) return null

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Ta-Te-Ti Arena
          </Typography>
          <Typography sx={{ mr: 2 }}>{user.name}</Typography>
          <Avatar src={user.avatar_url ?? undefined} sx={{ mr: 1 }} />
          <IconButton color="inherit" onClick={handleLogout}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ maxWidth: 800, mx: 'auto', p: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3 }}>
          Your Stats
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 4 }}>
          <StatsCard label="Wins" value={user.wins} color="success.main" />
          <StatsCard label="Losses" value={user.losses} color="error.main" />
          <StatsCard label="Draws" value={user.draws} color="text.secondary" />
        </Box>

        <Button
          variant="contained"
          size="large"
          onClick={handleFindMatch}
          sx={{ mb: 4, px: 6 }}
        >
          Find Match
        </Button>

        <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
          Match History
        </Typography>

        {user.match_history.length === 0 ? (
          <Typography sx={{ color: 'text.secondary' }}>No games played yet.</Typography>
        ) : (
          <Paper elevation={2}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Opponent</TableCell>
                  <TableCell>Result</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {user.match_history.map((item) => (
                  <TableRow key={item.game_id}>
                    <TableCell>{item.opponent}</TableCell>
                    <TableCell>
                      <Chip
                        label={item.result}
                        color={
                          item.result === 'WIN'
                            ? 'success'
                            : item.result === 'LOSS'
                              ? 'error'
                              : 'default'
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {item.date ? new Date(item.date).toLocaleDateString() : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Box>
    </Box>
  )
}
