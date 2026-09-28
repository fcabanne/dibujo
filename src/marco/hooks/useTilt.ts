import { useEffect, useRef, type MutableRefObject } from 'react'

/** La inclinación del teléfono como paralaje, en -1..1 por eje, igual que el puntero. */
export interface Tilt {
  x: number
  y: number
  /** Si ya llegó alguna lectura. Sin sensor, o sin permiso, queda en false. */
  active: boolean
}

/** Cuántos grados de inclinación mueven el paralaje de punta a punta del medio. */
const RANGE_DEG = 18

/**
 * Qué tan rápido se olvida la postura: por cada lectura (llegan unas sesenta por
 * segundo) el centro se corre este tanto hacia donde está el teléfono ahora. Con
 * 0,006 tarda unos tres segundos: lo bastante lento para que inclinar se vea, y lo
 * bastante rápido para que sostener el teléfono torcido no deje la escena torcida.
 */
const RECENTER = 0.006

/**
 * En escritorio la luz y el reflejo del vidrio siguen al mouse: es lo que hace que
 * el cuadro se lea como un objeto y no como una foto. En el celular no hay un
 * puntero que pase por encima, pero hay algo mejor: el teléfono mismo. Inclinarlo
 * corre la luz, el reflejo barre el cristal y asoma el canto de la moldura, como
 * pasa al mover la cabeza frente a un cuadro de verdad.
 *
 * Mide **cambios** de inclinación, no la postura: la forma natural de sostener el
 * teléfono es el centro, y ese centro se va acomodando solo.
 */
export function useTilt(enabled: boolean): MutableRefObject<Tilt> {
  const tilt = useRef<Tilt>({ x: 0, y: 0, active: false })

  useEffect(() => {
    if (!enabled) {
      tilt.current = { x: 0, y: 0, active: false }
      return
    }

    let center: { beta: number; gamma: number } | null = null

    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return
      // Acostado, los ejes del sensor quedan cruzados respecto de la pantalla. Los
      // iPhone viejos no tienen `screen.orientation` y lo dicen en `window.orientation`.
      const angle =
        screen.orientation?.angle ?? (window as { orientation?: number }).orientation ?? 0
      let beta = event.beta
      let gamma = event.gamma
      if (angle === 90) [beta, gamma] = [-gamma, beta]
      else if (angle === 270 || angle === -90) [beta, gamma] = [gamma, -beta]
      else if (angle === 180) [beta, gamma] = [-beta, -gamma]

      if (!center) center = { beta, gamma }
      center.beta += (beta - center.beta) * RECENTER
      center.gamma += (gamma - center.gamma) * RECENTER

      // Cuantizado a centésimos: el sensor tiembla aunque el teléfono esté quieto,
      // y cada temblor sería un cuadro más que pintar para nada.
      const round = (v: number) => Math.round(Math.max(-1, Math.min(1, v)) * 100) / 100
      tilt.current = {
        x: round((gamma - center.gamma) / RANGE_DEG),
        y: round((beta - center.beta) / RANGE_DEG),
        active: true,
      }
    }

    window.addEventListener('deviceorientation', onOrientation)
    return () => window.removeEventListener('deviceorientation', onOrientation)
  }, [enabled])

  return tilt
}

type OrientationWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

let asked = false

/**
 * En iPhone el sensor está cerrado hasta que la página pide permiso, y solo se lo
 * puede pedir en respuesta a un toque. Se pide una vez, al primer toque sobre el
 * cuadro: es el momento en que uno está "agarrando" el objeto, y el cartel del
 * sistema —que es el que explica, no una pantalla nuestra— llega con sentido. Si se
 * niega, no pasa nada: el dedo sobre la pared también corre la luz.
 *
 * En Android no hace falta: el sensor ya está abierto y esto no hace nada.
 *
 * Se llama al soltar el dedo y otra vez con el `click` que le sigue: no todas las
 * versiones de Safari cuentan el primero como un toque. Si el pedido fue rechazado por
 * no venir de un toque, se puede volver a pedir; si lo contestó la persona —que sí o
 * que no—, no se pregunta más.
 */
export function askTiltPermission(): void {
  if (asked) return
  const orientation = window.DeviceOrientationEvent as OrientationWithPermission | undefined
  if (typeof orientation?.requestPermission !== 'function') return
  asked = true
  orientation.requestPermission().catch(() => {
    asked = false
  })
}
