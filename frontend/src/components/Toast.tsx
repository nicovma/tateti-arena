import { Snackbar, Alert } from '@mui/material'
import useUiStore from '../store/uiStore'

export default function Toast() {
  const { toasts, removeToast } = useUiStore()

  return (
    <>
      {toasts.map((toast) => (
        <Snackbar
          key={toast.id}
          open
          autoHideDuration={4000}
          onClose={() => removeToast(toast.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={toast.severity} onClose={() => removeToast(toast.id)}>
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </>
  )
}
