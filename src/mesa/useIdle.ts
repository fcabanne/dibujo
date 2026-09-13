import { useEffect, useState } from 'react'

/**
 * Avisa cuando pasó un rato sin que nadie toque la pantalla.
 *
 * Los controles se apoyan sobre el dibujo, así que no pueden quedarse: se van solos
 * y vuelven con un toque en cualquier lado. Es la misma idea que en el probador de
 * enmarcado —la interfaz aparece cuando hace falta y desaparece cuando no— pero acá
 * importa más, porque abajo de la pantalla hay una hoja de papel.
 */
export function useIdle(delay: number, enabled: boolean): boolean {
  const [idle, setIdle] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setIdle(false)
      return
    }

    let timer = 0
    const wake = () => {
      setIdle(false)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setIdle(true), delay)
    }

    wake()
    // `pointerdown` cubre el toque; `pointermove` también el mouse del escritorio.
    window.addEventListener('pointerdown', wake)
    window.addEventListener('pointermove', wake)
    window.addEventListener('keydown', wake)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('pointermove', wake)
      window.removeEventListener('keydown', wake)
    }
  }, [delay, enabled])

  return idle
}
