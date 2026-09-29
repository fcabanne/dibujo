/**
 * La geometría del abanico, como cuentas y no como estilos: el menú, la zona que lo
 * mantiene abierto y la elección de hacia dónde se abre leen los mismos números.
 *
 * Las opciones se reparten en arcos concéntricos alrededor de la burbuja. Todos los
 * arcos usan **el mismo paso en píxeles** —no el mismo paso angular—: con un paso
 * angular compartido los arcos de adentro quedaban apretados y las muestras se
 * pisaban entre sí; con un paso en píxeles cada arco pide el radio que necesita y el
 * conjunto queda parejo, más ancho cuantas más muestras tiene.
 */

export interface Point {
  x: number
  y: number
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Diámetro de una muestra. */
export const CHIP = 46
/** Distancia entre centros de dos muestras vecinas del mismo arco. */
const SPACING = 54
/** Distancia entre arcos: una muestra y un respiro de doce píxeles. */
const ROW_GAP = 58
/** Lo más que se abre un arco. Más allá, las muestras del extremo se van demasiado lejos. */
const MAX_SWEEP = (140 * Math.PI) / 180
/** Radio del primer arco. */
const FIRST = 112

export interface FanLayout {
  /** Radio de cada arco, de adentro hacia afuera. */
  radii: number[]
  /** Paso angular de cada arco, en radianes. */
  steps: number[]
  counts: number[]
  /** Hasta dónde llega el abanico desde el centro de la burbuja. */
  reach: number
  /** Mitad del barrido del arco más ancho, en radianes. */
  halfSweep: number
}

export function layoutFan(counts: number[]): FanLayout {
  const radii: number[] = []
  const steps: number[] = []
  let r = FIRST

  counts.forEach((n, i) => {
    // El radio mínimo para que las n muestras entren en el barrido máximo.
    const need = n > 1 ? ((n - 1) * SPACING) / MAX_SWEEP : 0
    r = i === 0 ? Math.max(r, need) : Math.max(r + ROW_GAP, need)
    radii.push(r)
    steps.push(n > 1 ? SPACING / r : 0)
  })

  const widest = Math.max(0, ...counts.map((n, i) => (n - 1) * steps[i]))

  return {
    radii,
    steps,
    counts,
    reach: (radii[radii.length - 1] ?? FIRST) + CHIP / 2 + 8,
    halfSweep: widest / 2,
  }
}

/** Dónde cae la muestra `i` del arco `row`, respecto del centro de la burbuja. */
export function chipOffset(layout: FanLayout, row: number, i: number, centerRad: number): Point {
  const n = layout.counts[row]
  const angle = centerRad + (i - (n - 1) / 2) * layout.steps[row]
  return { x: Math.cos(angle) * layout.radii[row], y: Math.sin(angle) * layout.radii[row] }
}

const rad = (deg: number) => (deg * Math.PI) / 180

/**
 * Hacia dónde se abre: el ángulo (en grados, 0 = a la derecha) que deja el abanico
 * entero en pantalla y sin tapar el cuadro, lo más cerca posible del que se prefiere.
 *
 * El cuadro es lo que se está juzgando, así que un abanico que se abre encima suyo
 * es peor que uno que se corre de su lado favorito. Se prueba cada diez grados y se
 * queda el de menor costo: salirse de la pantalla y tapar el cuadro cuestan mucho, y
 * apartarse de lo preferido cuesta poco.
 */
export function chooseDirection(opts: {
  layout: FanLayout
  origin: Point
  view: { w: number; h: number }
  /** Lo que el abanico no debe tapar: el cuadro y la pastilla de volver. */
  avoid: Box[]
  prefer: number
}): number {
  const { layout, origin, view, avoid, prefer } = opts
  const margin = CHIP / 2 + 10
  let best = prefer
  let bestCost = Infinity

  for (let deg = -180; deg < 180; deg += 10) {
    const center = rad(deg)
    let cost = 0

    layout.counts.forEach((n, row) => {
      for (let i = 0; i < n; i++) {
        const o = chipOffset(layout, row, i, center)
        const x = origin.x + o.x
        const y = origin.y + o.y

        cost += Math.max(0, margin - x) + Math.max(0, x - (view.w - margin))
        cost += Math.max(0, margin - y) + Math.max(0, y - (view.h - margin))

        for (const box of avoid) {
          const pad = CHIP / 2 + 6
          const dx = Math.min(x - (box.x - pad), box.x + box.w + pad - x)
          const dy = Math.min(y - (box.y - pad), box.y + box.h + pad - y)
          if (dx > 0 && dy > 0) cost += 2 * Math.min(dx, dy) + CHIP
        }
      }
    })

    let apart = Math.abs(deg - prefer)
    if (apart > 180) apart = 360 - apart
    cost += apart * 0.7

    if (cost < bestCost) {
      bestCost = cost
      best = deg
    }
  }

  return best
}

/** ¿El punto cae dentro del cuerno del abanico? Es lo que lo mantiene abierto. */
export function inFan(p: Point, origin: Point, layout: FanLayout, centerDeg: number): boolean {
  const dx = p.x - origin.x
  const dy = p.y - origin.y
  const dist = Math.hypot(dx, dy)
  if (dist > layout.reach + 24) return false
  let diff = Math.atan2(dy, dx) - rad(centerDeg)
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  // Un margen de dieciséis grados: cortar camino en diagonal no lo cierra.
  return Math.abs(diff) <= layout.halfSweep + rad(16)
}
