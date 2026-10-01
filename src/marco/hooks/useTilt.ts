import { useEffect, useRef, type MutableRefObject } from 'react'

/** La inclinación del teléfono como paralaje, en -1..1 por eje, igual que el puntero. */
export interface Tilt {
  x: number
  y: number
  /** Si ya llegó alguna lectura. Sin sensor, o sin permiso, queda en false. */
  active: boolean
  /**
   * Cuánto está girado el teléfono en su plano respecto de la plomada, en radianes,
   * positivo en sentido horario. Sale del acelerómetro y no se recentra: un cuadro
   * cuelga derecho respecto del mundo, no de cómo se agarra el teléfono.
   */
  roll: number
}

/**
 * Cuánto de la plomada sigue el cuadro: un décimo. Siguiéndola entera —girar el
 * teléfono 10° y verlo girar 10°— era demasiado, y un cuarto también; poco se lee como peso, no
 * como un cuadro que se cae.
 */
const ROLL_FOLLOW = 0.1
/** Hasta dónde llega a inclinarse en la pantalla. */
const ROLL_LIMIT = (2 * Math.PI) / 180
/** Lo que el sensor tiembla quieto, en radianes: por debajo, no se mueve nada. */
const ROLL_STEP = (0.1 * Math.PI) / 180

/**
 * iOS informa la gravedad tal cual —derecho, y vale −9,8—; Android, como la pide la
 * especificación, la reacción del apoyo, con los signos al revés.
 */
const GRAVITY_SIGN =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
    ? 1
    : -1

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
  const tilt = useRef<Tilt>({ x: 0, y: 0, active: false, roll: 0 })

  useEffect(() => {
    if (!enabled) {
      tilt.current = { x: 0, y: 0, active: false, roll: 0 }
      return
    }

    // La plomada: hacia dónde tira la gravedad en el plano de la pantalla. Con el
    // teléfono acostado sobre la mesa no hay plomada que seguir, y se suelta de a poco.
    let roll = 0
    const onMotion = (event: DeviceMotionEvent) => {
      const g = event.accelerationIncludingGravity
      if (!g || g.x === null || g.y === null) return
      const angle = ((screen.orientation?.angle ?? (window as { orientation?: number }).orientation ?? 0) * Math.PI) / 180
      const x = g.x * Math.cos(angle) + g.y * Math.sin(angle)
      const y = -g.x * Math.sin(angle) + g.y * Math.cos(angle)
      const inPlane = Math.hypot(x, y) / 9.81
      let target = Math.atan2(GRAVITY_SIGN * x, -GRAVITY_SIGN * y)
      // Más de 45° ya no es inclinar: es dar vuelta el teléfono, o una lectura rara.
      if (Math.abs(target) > Math.PI / 4) target = 0
      target *= ROLL_FOLLOW * Math.min(1, Math.max(0, (inPlane - 0.25) / 0.35))
      target = Math.max(-ROLL_LIMIT, Math.min(ROLL_LIMIT, target))
      roll += (target - roll) * 0.25
      // Cuantizado: el sensor tiembla quieto, y cada temblor sería un cuadro más que pintar.
      const step = Math.round(roll / ROLL_STEP) * ROLL_STEP
      if (step !== tilt.current.roll) tilt.current = { ...tilt.current, roll: step }
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
        roll: tilt.current.roll,
      }
    }

    window.addEventListener('deviceorientation', onOrientation)
    window.addEventListener('devicemotion', onMotion)
    return () => {
      window.removeEventListener('deviceorientation', onOrientation)
      window.removeEventListener('devicemotion', onMotion)
    }
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
  // El acelerómetro (la plomada) se pide aparte; en iPhone es el mismo cartel.
  const motion = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined
  if (typeof orientation?.requestPermission !== 'function') return
  asked = true
  orientation.requestPermission().catch(() => {
    asked = false
  })
  motion?.requestPermission?.().catch(() => {})
}
