import { stepSpring, settleSpring, type Spring, type SpringParams } from '../../shared/motion'
import { dimsOf, type Dims } from '../domain/geometry'
import { REST_POSE, type Pose } from '../render/pose'
import type { AppState } from '../types'

/**
 * El cuadro como cosa: lo que se ve de él, que persigue a lo que dice el estado.
 *
 * El estado guarda la verdad —las medidas redondeadas que se encargan, el material
 * elegido—; el cuerpo guarda lo que se dibuja, que llega a esa verdad con resortes.
 * Cambiar el ancho de la moldura no la cambia de golpe: crece hasta su medida, con
 * el peso que tenga. Solo datos y funciones, como el resto del código.
 */
export interface Body {
  dims: Record<keyof Dims, Spring>
  pose: Pose
  /** La mano está arrastrando una banda: las medidas la siguen más rápido. */
  dragging: boolean
  /** El giro de la obra la última vez que se miró: si cambia, el ancho y el alto se cruzan. */
  rotation: number
  /**
   * La banda que tiene la mano, y hasta dónde la tira: entre muescas, un poco más
   * allá de la medida redondeada, y pasado el máximo, estirada. Al soltar se borra y
   * la banda vuelve a la medida del estado.
   */
  hand: { key: 'frame' | 'mat'; value: number; over: number } | null
}

const DIM_KEYS: (keyof Dims)[] = ['artW', 'artH', 'mat', 'frame']

/** Las medidas siguiendo un cambio: tipeado, elegido o al soltar un arrastre. Llegan con peso. */
const FOLLOW: SpringParams = { response: 0.3, damping: 0.8 }
/** Las medidas pegadas a la mano mientras se arrastra: rápidas, para no llegar tarde al puntero. */
const HAND: SpringParams = { response: 0.085, damping: 0.6 }
/** El marco o el passe-partout yéndose a cero, o volviendo: sin pasarse, que por debajo de cero no hay nada. */
const VANISH: SpringParams = { response: 0.22, damping: 0.9 }

/** Por debajo de esto (cm) una medida que se va a cero ya no se dibuja. */
export const GONE = 0.02

export function createBody(state: AppState): Body {
  const d = dimsOf(state)
  const spring = (x: number): Spring => ({ x, v: 0 })
  return {
    dims: { artW: spring(d.artW), artH: spring(d.artH), mat: spring(d.mat), frame: spring(d.frame) },
    pose: { ...REST_POSE },
    dragging: false,
    rotation: state.artwork.rotation,
    hand: null,
  }
}

/**
 * Lleva el cuerpo `dtMs` hacia el estado. Devuelve si sigue en movimiento: si no, no
 * hay nada que animar y el lienzo podría dormirse.
 *
 * Con movimiento reducido, o en el celular, llega en el acto.
 */
export function stepBody(body: Body, state: AppState, dtMs: number, instant: boolean): boolean {
  const target = dimsOf(state)
  const dt = dtMs / 1000
  let moving = false

  // Girar la obra cruza ancho y alto. No es que el cuadro se estire hasta la otra
  // forma: es el mismo cuadro, dado vuelta, así que las medidas se cruzan en el acto.
  if (state.artwork.rotation !== body.rotation) {
    if ((state.artwork.rotation - body.rotation) % 180 !== 0) {
      const { artW, artH } = body.dims
      body.dims.artW = artH
      body.dims.artH = artW
    }
    body.rotation = state.artwork.rotation
  }

  for (const key of DIM_KEYS) {
    const s = body.dims[key]
    const hand = body.hand && body.hand.key === key && !instant ? body.hand.value : null
    const to = hand ?? target[key]
    if (instant) {
      s.x = to
      s.v = 0
      continue
    }
    const toward = (key === 'mat' || key === 'frame') && (to === 0 || s.x < GONE) ? VANISH : body.dragging ? HAND : FOLLOW
    stepSpring(s, to, toward, dt)
    // Por debajo de cero no hay moldura: el resorte se frena ahí en vez de pasarse.
    if ((key === 'mat' || key === 'frame') && s.x < 0) {
      s.x = 0
      s.v = 0
    }
    if (!settleSpring(s, to, 0.002)) moving = true
  }

  return moving
}

/** Las medidas tal como se ven ahora. */
export function shownDims(body: Body): Dims {
  return {
    artW: body.dims.artW.x,
    artH: body.dims.artH.x,
    mat: body.dims.mat.x,
    frame: body.dims.frame.x,
  }
}
