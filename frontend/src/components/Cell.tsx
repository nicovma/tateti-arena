import { Button } from '@mui/material'

interface Props {
  value: string
  index: number
  onClick: (index: number) => void
  disabled: boolean
}

export default function Cell({ value, index, onClick, disabled }: Props) {
  return (
    <Button
      variant="outlined"
      onClick={() => onClick(index)}
      disabled={disabled || value !== ' '}
      sx={{
        width: { xs: 85, sm: 100 },
        height: { xs: 85, sm: 100 },
        fontSize: { xs: '2rem', sm: '2.5rem' },
        fontWeight: 'bold',
        color: value === 'X' ? 'primary.main' : 'error.main',
        borderRadius: 2,
        minWidth: 0,
      }}
    >
      {value === ' ' ? '' : value}
    </Button>
  )
}
