import { ToastContainer } from 'react-toastify'
import { useTheme } from './themeContext'

export function ThemedToastContainer(): JSX.Element {
  const { resolvedTheme } = useTheme()

  return (
    <ToastContainer
      position="bottom-right"
      autoClose={2600}
      closeOnClick
      pauseOnHover
      theme={resolvedTheme}
    />
  )
}
