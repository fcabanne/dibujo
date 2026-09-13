import { useEffect, useState } from 'react'

/**
 * Si la pantalla es angosta, los controles pasan de columna al costado a barra
 * abajo. El escritorio no cambia.
 *
 * El corte es por ancho y no por "¿es un celular?": lo que obliga a reacomodar es
 * que el panel y la foto no entran juntos, y eso pasa igual en una ventana angosta
 * de escritorio. Si el dedo importa —los targets, el hover— eso se pregunta aparte,
 * en el CSS, con `(hover: none)`: el ancho es un indicio del dedo, no el dedo.
 */
const NARROW = '(max-width: 720px)'

export function useCompact(): boolean {
  const [compact, setCompact] = useState(() => window.matchMedia(NARROW).matches)

  useEffect(() => {
    const query = window.matchMedia(NARROW)
    const sync = () => setCompact(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return compact
}
