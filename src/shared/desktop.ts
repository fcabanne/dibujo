import { useEffect, useState } from 'react'

/**
 * Un puntero que pasa por encima y apunta fino: mouse o trackpad, o sea una compu.
 *
 * Es la pregunta del puntero y no la del ancho, por lo mismo que en `useCompact`: una
 * ventana angosta de escritorio sigue siendo una compu, y un iPad o un teléfono acostado
 * no lo son por ancho que tengan. Una notebook táctil tiene mouse como puntero
 * principal, así que cuenta como compu.
 */
const QUERY = '(hover: hover) and (pointer: fine)'

export const isDesktop = () => window.matchMedia(QUERY).matches

export function useDesktop(): boolean {
  const [desktop, setDesktop] = useState(isDesktop)

  useEffect(() => {
    const query = window.matchMedia(QUERY)
    const sync = () => setDesktop(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return desktop
}
