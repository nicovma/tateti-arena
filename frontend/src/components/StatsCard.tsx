import { Paper, Typography } from '@mui/material'

interface Props {
  label: string
  value: number
  color?: string
}

export default function StatsCard({ label, value, color = 'text.primary' }: Props) {
  return (
    <Paper elevation={2} sx={{ p: 3, textAlign: 'center', flex: 1 }}>
      <Typography variant="h3" sx={{ fontWeight: 'bold', color }}>
        {value}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
        {label}
      </Typography>
    </Paper>
  )
}
