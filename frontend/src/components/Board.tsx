import { Box } from '@mui/material'
import Cell from './Cell'

interface Props {
  board: string[]
  onMove: (index: number) => void
  disabled: boolean
}

export default function Board({ board, onMove, disabled }: Props) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(3, 85px)', sm: 'repeat(3, 100px)' },
        gap: 1,
      }}
    >
      {board.map((value, index) => (
        <Cell
          key={index}
          value={value}
          index={index}
          onClick={onMove}
          disabled={disabled}
        />
      ))}
    </Box>
  )
}
