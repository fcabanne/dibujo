import { useEffect } from 'react'

/**
 * Mantiene la pantalla prendida mientras hay cámara.
 *
 * Dibujar es justamente no tocar el teléfono: a los treinta segundos se apaga solo
 * y hay que soltar el lápiz para despertarlo. Sin esto la herramienta es linda y no
 * se puede usar.
 *
 * El sistema suelta el permiso cuando la pestaña se va a segundo plano y no lo
 * devuelve al volver, así que se vuelve a pedir al reaparecer.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const request = async () => {
      try {
        const granted = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void granted.release()
          return
        }
        sentinel = granted
        granted.addEventListener('release', () => {
          sentinel = null
        })
      } catch {
        // Batería baja o pestaña oculta: el navegador lo niega y no hay nada que
        // hacer al respecto. La herramienta anda igual, la pantalla se apaga sola.
      }
    }

    const renew = () => {
      if (document.visibilityState === 'visible' && !sentinel) void request()
    }

    void request()
    document.addEventListener('visibilitychange', renew)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', renew)
      void sentinel?.release()
      sentinel = null
    }
  }, [active])
}
