import { useState, useRef, useEffect } from 'react'
import { Box, TextField, IconButton, Typography, Paper } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'

interface Message {
  sender: string
  text: string
}

interface Props {
  messages: Message[]
  onSend: (text: string) => void
  myName: string
}

export default function ChatBox({ messages, onSend, myName }: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    onSend(text)
    setInput('')
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 300, width: { xs: '100%', md: 280 } }}>
      <Paper elevation={1} sx={{ flex: 1, overflowY: 'auto', p: 1, mb: 1, bgcolor: 'grey.50' }}>
        {messages.map((msg, i) => (
          <Box key={i} sx={{ mb: 0.5 }}>
            <Typography
              variant="caption"
              sx={{ fontWeight: 'bold', color: msg.sender === myName ? 'primary.main' : 'text.primary' }}
            >
              {msg.sender}:{' '}
            </Typography>
            <Typography variant="caption">{msg.text}</Typography>
          </Box>
        ))}
        <div ref={bottomRef} />
      </Paper>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          size="small"
          fullWidth
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Message..."
        />
        <IconButton onClick={handleSend} color="primary">
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  )
}
