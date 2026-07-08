import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import App from './App'
import { ThemeProvider, useTheme } from './app/theme'
import './index.css'
import 'react-toastify/dist/ReactToastify.css'

function ThemedToastContainer(): JSX.Element {
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <HashRouter>
        <App />
        <ThemedToastContainer />
      </HashRouter>
    </ThemeProvider>
  </React.StrictMode>,
)
