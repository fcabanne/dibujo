import { useState } from 'react'
import { copy } from '../../shared/copy'
import { Button, CloseIcon, IconButton } from '../../shared/ui'
import { NAMED_COLORS } from './controls'
import type { Action } from '../state/reducer'
import type { AppState } from '../types'

/** Por debajo de esto la foto ya es casi papel, y una línea clara encima no se ve. */
const FADED = 0.45

/** El negro de las muestras, para que el cambio caiga en una muestra con nombre. */
const BLACK = NAMED_COLORS.find((color) => color.name === copy.grid.colors.black)!.value

/**
 * Un aviso chico, arriba y al medio, cuando la foto está tan apagada que las líneas
 * claras se pierden contra el papel: ofrece pasarlas a negro.
 *
 * Sugiere y no decide: el color es de quien dibuja, y puede que justo quiera las
 * líneas casi invisibles. Se cierra con la X, y cerrado no vuelve en toda la sesión:
 * un aviso que insiste deja de ser ayuda.
 */
export function LinesHint({
  state,
  dispatch,
}: {
  state: AppState
  dispatch: (action: Action) => void
}) {
  const [dismissed, setDismissed] = useState(false)

  const gridLight = state.grid.mode !== 'none' && state.grid.style.opacity > 0 && isLight(state.grid.style.color)
  const headLight = state.head.mode !== 'none' && state.head.style.opacity > 0 && isLight(state.head.style.color)
  if (dismissed || state.effects.opacity > FADED || (!gridLight && !headLight)) return null

  const toBlack = () => {
    if (gridLight) dispatch({ type: 'grid/style', patch: { color: BLACK } })
    if (headLight) dispatch({ type: 'head/style', patch: { color: BLACK } })
  }

  return (
    <div className="lines-hint" role="status">
      <p>{copy.notices.lightLines}</p>
      <Button variant="quiet" onClick={toBlack}>
        {copy.notices.toBlack}
      </Button>
      <IconButton label={copy.download.close} onClick={() => setDismissed(true)}>
        <CloseIcon />
      </IconButton>
    </div>
  )
}

/** Si un color es claro: blanco, amarillo, celeste. Acepta `#rgb` y `#rrggbb`. */
function isLight(color: string): boolean {
  const hex = color.replace('#', '')
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex
  const n = parseInt(full.slice(0, 6), 16)
  if (Number.isNaN(n)) return false
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 150
}
