import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
// Después de la del escritorio: la del celular pisa lo poco que comparten, como la
// cartela, y solo bajo `.is-compact`.
import './mobile.css'

const root = document.getElementById('root')
if (!root) throw new Error('Falta el nodo #root')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
