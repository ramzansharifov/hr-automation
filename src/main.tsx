import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './shared/i18n'
import App from './App'
import { ThemedToastContainer } from './app/ThemedToastContainer'
import { ThemeProvider } from './app/theme'
import './index.css'
import 'react-toastify/dist/ReactToastify.css'

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
