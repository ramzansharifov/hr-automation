import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import App from './App'
import './index.css'
import 'react-toastify/dist/ReactToastify.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
      <ToastContainer
        position="bottom-right"
        autoClose={2600}
        closeOnClick
        pauseOnHover
        theme="light"
      />
    </HashRouter>
  </React.StrictMode>,
)