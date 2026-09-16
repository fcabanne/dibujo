import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { copy, language } from '../shared/copy'
// El sistema de diseño primero: sus estilos son la base sobre la que escribe la
// hoja de esta herramienta, y el orden del CSS es el orden de estos imports.
import '../shared/ui'
import { App } from './App'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Falta el nodo #root')

// El título de la pestaña y el idioma del documento también son texto: salen del
// mismo archivo que el resto y no del HTML, que no sabe en qué idioma se abrió.
document.title = copy.app.title
document.documentElement.lang = language

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
