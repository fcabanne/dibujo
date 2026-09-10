import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('Falta el nodo #root')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
