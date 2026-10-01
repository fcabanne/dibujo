import { settleSpring as atRest, stepSpring, type Spring, type SpringParams } from '../../shared/motion'
import { dimsOf, layoutFromDims, type Dims } from '../domain/geometry'
import { DEGREES, naturalFrequency, nudge, stepPendulum, type Pendulum } from './pendulum'
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
  /** La pose tal como se dibuja: sale de los resortes de abajo en cada paso. */
  pose: Pose
  /** La cuña de arriba, como fracción de la de reposo: 1 colgado, menos apretado contra la pared. */
  lean: Spring
  /** Hacia dónde va la cuña: 1 suelto, menos mientras la mano lo aprieta. */
  leanTarget: number
  /** El asiento en el alambre, en cm: baja al ganar peso, sube al perderlo, y vuelve. */
  drop: Spring
  /** Cuánto pesa ahora, en kg: decide cómo llega todo. */
  kg: number
  /** El balanceo sobre el clavo. */
  swing: Pendulum
  /** Su frecuencia natural, rad/s: sale de la forma del cuadro. */
  omega: number
  /** Lo que le falta para terminar de girar, en radianes: llega a cero con peso. */
  turn: Spring
  /** Si está a mitad de un giro: al terminar, apoya. */
  turning: boolean
  /** Despegado de la pared hacia el ojo, en cm: al colgarlo o al girarlo en el aire. */
  lift: Spring
  /** Colgándose: el asiento usa el resorte del colgado, no el del peso. */
  hanging: number
  /** Lo que pasó en el último paso y suena: apoyó, se enganchó en el clavo. */
  events: BodyEvent[]
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

/** Lo que le pasa al cuadro como cosa, y suena. */
export type BodyEvent = 'turn-start' | 'turn-land' | 'hang-wire' | 'hang-wall'

const DIM_KEYS: (keyof Dims)[] = ['artW', 'artH', 'mat', 'frame']

/** Las medidas siguiendo un cambio: tipeado, elegido o al soltar un arrastre. Llegan con peso. */
const FOLLOW: SpringParams = { response: 0.3, damping: 0.8 }
/**
 * Las medidas pegadas a la mano mientras se arrastra: rápidas, para no llegar tarde al
 * puntero, y con un poco de rebote para que cada muesca se sienta caer.
 */
const HAND: SpringParams = { response: 0.12, damping: 0.45 }
/** El marco o el passe-partout yéndose a cero, o volviendo: sin pasarse, que por debajo de cero no hay nada. */
const VANISH: SpringParams = { response: 0.22, damping: 0.9 }

/** Apretarlo contra la pared: rápido y sin rebote, la mano manda. */
const PRESS: SpringParams = { response: 0.14, damping: 0.75 }
/** Soltarlo: el alambre lo devuelve, y se pasa un poco antes de quedarse. */
const RELEASE: SpringParams = { response: 0.42, damping: 0.45 }
/** Cuánto aplasta la cuña la mano, apretando del canto de arriba. */
const PRESS_DEPTH = 0.6

/** El giro de 90°: con peso, y pasándose apenas un grado. */
const TURN: SpringParams = { response: 0.55, damping: 0.82 }
/** Colgarlo: el alambre lo recibe y rebota un poco. */
const HANG_DROP: SpringParams = { response: 0.32, damping: 0.55 }
/** Colgarlo: lo apoya contra la pared, sin rebote. */
const HANG_LIFT: SpringParams = { response: 0.38, damping: 0.75 }

function omegaOf(d: Dims): number {
  const { outer } = layoutFromDims(d)
  return naturalFrequency(outer.w, outer.h)
}

/** Un peso de referencia, en kg: el de un 30 × 40 con passe-partout, marco y vidrio. */
const REFERENCE_KG = 1.5

/** El asiento en el alambre según el peso: uno pesado llega lento y sin rebote, uno liviano rebota. */
function settleSpring(kg: number): SpringParams {
  const r = kg / REFERENCE_KG
  return {
    response: 0.26 * Math.pow(r, 0.3),
    damping: Math.min(0.8, Math.max(0.45, 0.45 + (r - 0.5) * 0.25)),
  }
}

/** Por debajo de esto (cm) una medida que se va a cero ya no se dibuja. */
export const GONE = 0.02

export function createBody(state: AppState): Body {
  const d = dimsOf(state)
  const spring = (x: number): Spring => ({ x, v: 0 })
  return {
    dims: { artW: spring(d.artW), artH: spring(d.artH), mat: spring(d.mat), frame: spring(d.frame) },
    pose: { ...REST_POSE },
    lean: spring(1),
    leanTarget: 1,
    drop: spring(0),
    kg: 1.5,
    swing: { angle: 0, velocity: 0 },
    omega: 5,
    turn: spring(0),
    turning: false,
    lift: spring(0),
    hanging: 0,
    events: [],
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
  body.events = []
  body.omega = omegaOf(target)

  // Girar la obra cruza ancho y alto. No es que el cuadro se estire hasta la otra
  // forma: es el mismo cuadro, dado vuelta, así que las medidas se cruzan en el acto.
  // Y para que se vea como lo que es —alguien lo descolgó, lo giró y lo volvió a
  // colgar—, el cuadro arranca girado al revés de lo que se giró la obra, así que el
  // primer cuadro es idéntico al anterior, y llega a derecho con su peso.
  if (state.artwork.rotation !== body.rotation) {
    const delta = (state.artwork.rotation - body.rotation + 360) % 360
    if (delta % 180 !== 0) {
      const { artW, artH } = body.dims
      body.dims.artW = artH
      body.dims.artH = artW
    }
    body.rotation = state.artwork.rotation
    if (!instant) {
      body.turn.x += delta === 270 ? Math.PI / 2 : -(delta * Math.PI) / 180
      body.turn.v = 0
      body.turning = true
      body.events.push('turn-start')
    }
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
    const toward =
      (key === 'mat' || key === 'frame') && (to === 0 || s.x < GONE)
        ? VANISH
        : body.dragging
          ? HAND
          : followFor(body.kg)
    stepSpring(s, to, toward, dt)
    // Por debajo de cero no hay moldura: el resorte se frena ahí en vez de pasarse.
    if ((key === 'mat' || key === 'frame') && s.x < 0) {
      s.x = 0
      s.v = 0
    }
    if (!atRest(s, to, 0.002)) moving = true
  }

  // La pose: la cuña que se aprieta y se suelta, y el asiento en el alambre.
  if (instant) {
    body.lean.x = body.leanTarget
    body.lean.v = 0
    body.drop.x = 0
    body.drop.v = 0
    body.swing.angle = 0
    body.swing.velocity = 0
    body.turn.x = 0
    body.turn.v = 0
    body.turning = false
    body.lift.x = 0
    body.lift.v = 0
    body.hanging = 0
  } else {
    stepSpring(body.lean, body.leanTarget, body.leanTarget < 1 ? PRESS : RELEASE, dt)
    if (!atRest(body.lean, body.leanTarget, 0.002)) moving = true

    // Colgándose, el asiento es el del alambre que recibe el cuadro; después, el del peso.
    const wasAbove = body.drop.x < 0
    stepSpring(body.drop, 0, body.hanging > 0 ? HANG_DROP : settleSpring(body.kg), dt)
    if (!atRest(body.drop, 0, 0.0005)) moving = true
    if (body.hanging > 0 && wasAbove && body.drop.x >= 0) body.events.push('hang-wire')

    // El giro: llega a derecho con peso, y al apoyar le deja un vaivén al péndulo.
    if (body.turning) {
      stepSpring(body.turn, 0, TURN, dt)
      if (Math.abs(body.turn.x) < 1.5 * DEGREES && Math.abs(body.turn.v) < 0.5) {
        body.turning = false
        body.events.push('turn-land')
        nudge(body.swing, body.omega, 0.6 * DEGREES * Math.sign(body.turn.v || 1))
      }
      moving = true
    } else {
      stepSpring(body.turn, 0, TURN, dt)
      if (!atRest(body.turn, 0, 0.0002)) moving = true
    }

    // Despegado de la pared: vuelve a apoyar. Colgándose, recién después de engancharse.
    const liftWait = body.hanging > 0 && performance.now() - body.hanging < 120
    if (!liftWait) {
      const wasOff = body.lift.x > 0.15
      stepSpring(body.lift, 0, HANG_LIFT, dt)
      if (body.hanging > 0 && wasOff && body.lift.x <= 0.15) {
        body.events.push('hang-wall')
        body.hanging = 0
      }
    }
    if (!atRest(body.lift, 0, 0.002)) moving = true

    if (stepPendulum(body.swing, body.omega, dt)) moving = true
  }

  // Apretado contra la pared, el cuadro está un poco más lejos del ojo: se achica un
  // pelo. Es la mitad de lo que bajó la cuña, que es lo que se movió su centro. En el
  // aire —girándolo, colgándolo— está más cerca.
  const standoffCm = 1.2
  const turnLift = 2.5 * Math.pow(Math.min(1, Math.abs(body.turn.x) / (Math.PI / 2)), 0.7)
  body.pose.lean = body.lean.x
  body.pose.lift = -(1 - body.lean.x) * standoffCm * 0.5 + body.lift.x + turnLift
  body.pose.drop = body.drop.x
  body.pose.roll = body.swing.angle
  body.pose.turn = body.turn.x

  return moving
}

/** Las medidas siguiendo un cambio, con el peso del cuadro: uno pesado crece más lento. */
function followFor(kg: number): SpringParams {
  return { response: FOLLOW.response * Math.pow(kg / REFERENCE_KG, 0.25), damping: FOLLOW.damping }
}

/**
 * La mano apoya en una banda y empuja el cuadro contra la pared. Apretando arriba se
 * aplasta la cuña entera; abajo casi nada, porque ese canto ya apoya.
 *
 * `y` es dónde apoyó, de 0 (arriba del cuadro) a 1 (abajo).
 */
export function press(body: Body, y: number) {
  const hf = Math.min(1, Math.max(0.25, 1.2 - y))
  body.leanTarget = 1 - PRESS_DEPTH * hf
}

/** La mano lo suelta: el alambre lo devuelve a colgar. */
export function release(body: Body) {
  body.leanTarget = 1
}

/**
 * El cuadro cambió de peso: se asienta en el alambre. Baja si ganó, sube si perdió,
 * y vuelve a su lugar —el encuadre no se corre de una configuración a otra—. Un
 * cambio que no pesa nada, como un color nuevo del mismo material, apenas lo mueve.
 * Y la cuña se aprieta un instante con él.
 */
export function settle(body: Body, deltaKg: number) {
  const kg = Math.max(0.2, body.kg)
  const amplitude = Math.max(-0.35, Math.min(0.35, (0.12 * deltaKg) / Math.sqrt(kg))) + 0.03 * Math.sign(deltaKg || 1)
  const omega = (2 * Math.PI) / settleSpring(kg).response
  body.drop.v += amplitude * omega * 1.3
  body.lean.v -= Math.abs(amplitude) * 4
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

/**
 * La banda cayó en una muesca nueva: un empujón en el sentido en que venía, para que
 * se pase un pelo y vuelva. Es el cuerpo del clic.
 */
export function detentKick(body: Body, key: 'frame' | 'mat', direction: number) {
  body.dims[key].v += Math.sign(direction) * 8
}

/**
 * Un dibujo nuevo se cuelga: aparece un poco más arriba y despegado de la pared, el
 * alambre lo recibe con un tirón y un vaivén, y después se apoya contra la pared.
 */
export function hang(body: Body, side: number) {
  body.drop.x = -2
  body.drop.v = 0
  body.lift.x = 3
  body.lift.v = 0
  body.hanging = performance.now()
  body.swing.angle = 0
  body.swing.velocity = 0
  nudge(body.swing, body.omega, 2.2 * DEGREES * (side < 0 ? -1 : 1))
}

/**
 * Elegir algo de un costado lo toca de ese costado: un vaivén leve, más grande cuanto
 * más cambió el peso, que el clavo frena y el alambre endereza en un segundo.
 * `side` es de dónde viene la mano: -1 izquierda, 1 derecha, 0 de abajo.
 */
export function sway(body: Body, deltaKg: number, side: number, floor = 0.25) {
  if (side === 0) return
  const kg = Math.max(0.2, body.kg)
  const amplitude = Math.min(0.6, (0.25 * Math.abs(deltaKg)) / Math.sqrt(kg) + floor) * DEGREES
  nudge(body.swing, body.omega, amplitude * side)
}
