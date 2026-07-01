import { Box, Typography, Paper } from '@mui/material'
import { GoogleLogin } from '@react-oauth/google'
import type { CredentialResponse } from '@react-oauth/google'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import useUiStore from '../store/uiStore'

export default function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const addToast = useUiStore((s) => s.addToast)
  const navigate = useNavigate()

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    try {
      await login(credentialResponse.credential!)
      navigate('/dashboard')
    } catch {
      addToast('Login failed. Please try again.', 'error')
    }
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'grey.100' }}>
      <Paper elevation={3} sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
          Ta-Te-Ti Arena
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
          Play in real time against another player
        </Typography>
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => addToast('Google login failed', 'error')}
        />
      </Paper>
    </Box>
  )
}
