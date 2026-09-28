import { useEffect, useState } from 'react'

/**
 * Cuándo va la interfaz de celular en vez de la de escritorio.
 *
 * En Referencia alcanza con el ancho, porque su panel funciona igual con el dedo:
 * lo que cambia es solo el acomodo. Acá no. La interfaz de escritorio **vive del
 * puntero que pasa por encima** —las burbujas despiertan al mover el mouse, los
 * abanicos se abren al pasar, el paralaje sigue al cursor—, así que en una pantalla
 * que solo se toca no aparece nunca, por ancha que sea: un iPad o un teléfono
 * acostado pasan de los 720 px y se quedarían sin controles.
 *
 * Por eso son dos condiciones y cualquiera alcanza: angosta, o sin un puntero que
 * pase por encima. Una notebook táctil tiene mouse o trackpad como puntero principal
 * (`hover: hover`) y sigue recibiendo la de escritorio, que es la que le sirve.
 */
const QUERY = '(max-width: 720px), (hover: none) and (pointer: coarse)'

export function useCompact(): boolean {
  const [compact, setCompact] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const query = window.matchMedia(QUERY)
    const sync = () => setCompact(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return compact
}
