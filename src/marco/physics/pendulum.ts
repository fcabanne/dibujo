/**
 * El balanceo de un cuadro colgado de un clavo.
 *
 * Es un péndulo físico: el cuadro gira sobre el clavo, y lo que tarda en ir y volver
 * lo decide su forma, no su peso —un cuadro grande va más lento, uno chico se
 * apura—. Frena por dos lados: un poco de aire, y el roce del alambre en el clavo,
 * que es lo que hace que un cuadro de verdad se detenga en seco en vez de seguir
 * temblando. Ya casi quieto, el alambre lo deja nivelado: se termina de enderezar
 * despacio, porque un cuadro torcido no sirve para juzgar nada.
 */

export interface Pendulum {
  /** Ángulo, en radianes. Positivo, en el sentido de las agujas del reloj. */
  angle: number
  /** Velocidad angular, rad/s. */
  velocity: number
}

const G = 9.81
const DEG = Math.PI / 180

/** El aire: poco. Lo que de verdad lo frena es el clavo. */
const AIR = 0.15
/** El roce en el clavo, como ángulo: cuánto pierde cada vaivén. */
const NAIL_FRICTION = 0.08 * DEG
/** Por debajo de esto, casi quieto, el alambre lo endereza. */
const STILL = 0.12 * DEG
/** Cuánto tarda en enderezarse, ya casi quieto (s). */
const LEVEL_TIME = 0.25
/** Hasta dónde llega a inclinarse: más que esto se descolgaría. */
const LIMIT = 7 * DEG

const STEP = 1 / 240

/**
 * La frecuencia natural del cuadro, rad/s. `heightCm` y `widthCm` son los del cuadro
 * terminado; el clavo queda un poco por encima del centro.
 */
export function naturalFrequency(widthCm: number, heightCm: number): number {
  const w = widthCm / 100
  const h = heightCm / 100
  const L = 0.22 * h
  return Math.sqrt((G * L) / ((w * w + h * h) / 12 + L * L))
}

/**
 * Avanza el péndulo `dt` segundos. `torque` es lo que suma una mano que lo empuja,
 * como aceleración angular. Devuelve si sigue moviéndose.
 */
export function stepPendulum(p: Pendulum, omega: number, dt: number, torque = 0): boolean {
  const w2 = omega * omega
  let left = dt
  while (left > 0) {
    const h = Math.min(STEP, left)
    left -= h

    const stillish = Math.abs(p.velocity) < STILL * omega * 0.5 && Math.abs(p.angle) < STILL && torque === 0
    if (stillish) {
      // El alambre lo endereza: sin vaivén, solo llega a cero.
      p.angle *= Math.exp(-h / LEVEL_TIME)
      p.velocity = 0
      continue
    }

    const friction = Math.sign(p.velocity) * NAIL_FRICTION * w2
    const a = -w2 * Math.sin(p.angle) - 2 * AIR * omega * p.velocity - friction + torque
    p.velocity += a * h
    p.angle += p.velocity * h

    // Pasado el límite, no se inclina más: el alambre se tensa del otro lado.
    if (Math.abs(p.angle) > LIMIT) {
      p.angle = Math.sign(p.angle) * LIMIT
      p.velocity *= -0.3
    }
  }

  if (Math.abs(p.angle) < 1e-5 && Math.abs(p.velocity) < 1e-4) {
    p.angle = 0
    p.velocity = 0
    return false
  }
  return true
}

/** Un golpe de costado: lo deja moviéndose de modo que llegue a `amplitude` (rad). */
export function nudge(p: Pendulum, omega: number, amplitude: number) {
  p.velocity += amplitude * omega
}

export const DEGREES = DEG
