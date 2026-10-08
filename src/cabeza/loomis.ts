import { CANONICAL } from './canonical'
import { cameraInHead, project, type Camera, type Pose, type Vec3 } from './pose'

/**
 * La cabeza de Loomis, armada una sola vez sobre la cara canónica.
 *
 * Todo en centímetros y en el sistema de la cara: x a la derecha de la foto, y hacia
 * arriba, z hacia el que mira. Como la pose ya calza la cara canónica sobre la foto,
 * lo que se arme acá cae solo donde va, con la perspectiva de la lente.
 *
 * Las medidas salen de la cara y no de un número inventado: la línea de las cejas
 * (punto 9), la base de la nariz (2) y el mentón (152). Loomis divide la cara en
 * tres partes iguales —pelo a cejas, cejas a nariz, nariz a mentón— y en la cara
 * canónica salen 7,0 y 7,3 cm: el método y la malla coinciden.
 */

const at = (i: number): Vec3 => [CANONICAL[i * 3], CANONICAL[i * 3 + 1], CANONICAL[i * 3 + 2]]

const BROW = at(9)
const NOSE = at(2)
const CHIN = at(152)

/** Un tercio de cara: de las cejas a la base de la nariz. */
const UNIT = BROW[1] - NOSE[1]
/**
 * El radio de la bola. Con uno y medio el corte del costado —un círculo de un
 * tercio de radio, de la línea del pelo a la base de la nariz— cae a 7,8 cm del
 * medio, que es lo que mide la cara de ancho.
 */
const RADIUS = 1.5 * UNIT
/** El centro de la bola: a la altura de las cejas, con la frente sobre su superficie. */
const CENTER: Vec3 = [0, BROW[1], BROW[2] - RADIUS]
/** Dónde se corta la bola a cada lado. */
const SIDE = Math.sqrt(RADIUS * RADIUS - UNIT * UNIT)

/** Un punto de una línea, y hacia dónde mira la superficie en la que está. */
interface Mark {
  p: Vec3
  /** La normal de la superficie; null para lo que se ve siempre (el contorno). */
  n: Vec3 | null
}

type Line = Mark[]

const SEGMENTS = 96

const sphereNormal = (p: Vec3): Vec3 => [
  (p[0] - CENTER[0]) / RADIUS,
  (p[1] - CENTER[1]) / RADIUS,
  (p[2] - CENTER[2]) / RADIUS,
]

/**
 * Un arco sobre la bola, recortado donde la cortan los costados y donde `keep`
 * diga que no va.
 */
function sphereArc(
  point: (a: number) => Vec3,
  from: number,
  to: number,
  keep: (p: Vec3) => boolean = () => true,
): Line[] {
  const lines: Line[] = []
  let current: Line = []
  for (let i = 0; i <= SEGMENTS; i++) {
    const p = point(from + ((to - from) * i) / SEGMENTS)
    if (Math.abs(p[0]) > SIDE + 1e-6 || !keep(p)) {
      if (current.length > 1) lines.push(current)
      current = []
      continue
    }
    current.push({ p, n: sphereNormal(p) })
  }
  if (current.length > 1) lines.push(current)
  return lines
}

/** Las líneas fijas de la cabeza: no dependen de la pose. */
function headLines(): { lines: Line[]; planes: Line[] } {
  const lines: Line[] = []
  const planes: Line[] = []
  const [cx, cy, cz] = CENTER

  // La línea de las cejas: el ecuador de la bola, de un corte al otro.
  lines.push(
    ...sphereArc((a) => [cx + RADIUS * Math.sin(a), cy, cz + RADIUS * Math.cos(a)], -Math.PI, Math.PI),
  )

  // La línea del medio: el meridiano, de la frente por arriba hasta la nuca.
  lines.push(
    ...sphereArc((a) => [cx, cy + RADIUS * Math.sin(a), cz + RADIUS * Math.cos(a)], 0, 1.25 * Math.PI),
  )

  // Los cortes de los costados: el círculo, y su cruz.
  for (const side of [-1, 1]) {
    const x = side * SIDE
    const n: Vec3 = [side, 0, 0]
    const circle: Line = []
    for (let i = 0; i <= SEGMENTS; i++) {
      const a = (2 * Math.PI * i) / SEGMENTS
      circle.push({ p: [x, cy + UNIT * Math.sin(a), cz + UNIT * Math.cos(a)], n })
    }
    planes.push(circle)
    lines.push(circle)
    lines.push([
      { p: [x, cy + UNIT, cz], n },
      { p: [x, cy - UNIT, cz], n },
    ])
    lines.push([
      { p: [x, cy, cz - UNIT], n },
      { p: [x, cy, cz + UNIT], n },
    ])

    // La oreja: entre la línea de las cejas y la de la nariz, apenas detrás de
    // la vertical del corte.
    const ear: Line = []
    for (let i = 0; i <= SEGMENTS / 2; i++) {
      const a = (4 * Math.PI * i) / SEGMENTS
      ear.push({
        p: [x, cy - UNIT / 2 + (UNIT / 2) * Math.sin(a), cz - 0.3 * UNIT + 0.28 * UNIT * Math.cos(a)],
        n,
      })
    }
    lines.push(ear)
  }

  // El plano de la cara: de las cejas a la nariz y al mentón, por el medio.
  const front: Vec3 = [0, 0, 1]
  const browFront: Vec3 = [0, BROW[1], BROW[2]]
  const noseFront: Vec3 = [0, NOSE[1], NOSE[2]]
  const chin: Vec3 = [0, CHIN[1], CHIN[2]]
  lines.push([
    { p: browFront, n: front },
    { p: noseFront, n: front },
    { p: chin, n: front },
  ])

  // La línea del pelo y la de la nariz, cruzando la cara.
  // A esa altura la bola mide de radio lo mismo que el corte del costado.
  const hair = cy + UNIT
  lines.push(
    ...sphereArc((a) => [SIDE * Math.sin(a), hair, cz + SIDE * Math.cos(a)], -0.35, 0.35),
  )
  const noseHalf = 0.45 * UNIT
  lines.push([
    { p: [-noseHalf, NOSE[1], NOSE[2] - 0.6], n: front },
    { p: [noseHalf, NOSE[1], NOSE[2] - 0.6], n: front },
  ])

  // La mandíbula: de abajo del corte, por el ángulo, al mentón.
  const chinHalf = 0.2 * UNIT
  for (const side of [-1, 1]) {
    const n: Vec3 = [side, -0.3, 0.4]
    lines.push([
      { p: [side * SIDE, cy - UNIT, cz], n },
      { p: [side * SIDE * 0.86, CHIN[1] + 0.45 * UNIT, cz + 0.25 * UNIT], n },
      { p: [side * chinHalf, CHIN[1], CHIN[2] - 0.3], n },
    ])
  }
  // La base del mentón.
  lines.push([
    { p: [-chinHalf, CHIN[1], CHIN[2] - 0.3], n: [0, -0.4, 1] },
    { p: [chinHalf, CHIN[1], CHIN[2] - 0.3], n: [0, -0.4, 1] },
  ])

  return { lines, planes }
}

const HEAD = headLines()

/**
 * El contorno de la bola tal como la ve la cámara: el círculo donde la tocan las
 * rectas que salen del ojo. Cambia con la pose, así que se calcula en cada dibujo.
 */
function silhouette(eye: Vec3): Line[] {
  const d: Vec3 = [CENTER[0] - eye[0], CENTER[1] - eye[1], CENTER[2] - eye[2]]
  const dist2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2]
  if (dist2 <= RADIUS * RADIUS) return []
  const k = (RADIUS * RADIUS) / dist2
  // El centro del círculo de contacto, corrido hacia el ojo; y su radio.
  const c: Vec3 = [CENTER[0] - d[0] * k, CENTER[1] - d[1] * k, CENTER[2] - d[2] * k]
  const r = RADIUS * Math.sqrt(1 - k)
  const len = Math.sqrt(dist2)
  const w: Vec3 = [d[0] / len, d[1] / len, d[2] / len]
  // Dos ejes perpendiculares a la mirada.
  const helper: Vec3 = Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const u = normalize(cross(w, helper))
  const v = cross(w, u)

  return sphereArc(
    (a) => [
      c[0] + r * (Math.cos(a) * u[0] + Math.sin(a) * v[0]),
      c[1] + r * (Math.cos(a) * u[1] + Math.sin(a) * v[1]),
      c[2] + r * (Math.cos(a) * u[2] + Math.sin(a) * v[2]),
    ],
    0,
    2 * Math.PI,
    // Debajo de la nariz la bola queda detrás de la cara y la mandíbula: dibujada,
    // es una línea suelta cruzando la boca.
    (p) => p[1] >= NOSE[1],
  ).map((line) => line.map(({ p }) => ({ p, n: null })))
}

export interface LoomisStyle {
  color: string
  halo: string
  width: number
}

/**
 * Dibuja la cabeza. `scale` lleva de píxeles de la foto a píxeles del lienzo, que
 * ya tiene corrido el origen hasta la esquina de la foto.
 *
 * Lo que queda del otro lado de la bola va punteado y más suave: se dibuja igual,
 * como hace quien construye la cabeza, pero no se confunde con lo que se ve.
 */
export function drawLoomis(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  pose: Pose,
  scale: number,
  style: LoomisStyle,
) {
  const eye = cameraInHead(pose)
  const facing = (m: Mark) => {
    if (!m.n) return true
    const toEye: Vec3 = [eye[0] - m.p[0], eye[1] - m.p[1], eye[2] - m.p[2]]
    return dot(m.n, toEye) > 0
  }

  const toScreen = (p: Vec3) => {
    const [u, v] = project(cam, pose, p)
    return [u * scale, v * scale] as const
  }
  // Un punto pegado o detrás de la cámara se proyecta al infinito: no se dibuja.
  const inFront = (p: Vec3) => project(cam, pose, p)[2] > 1
  if (!inFront(CENTER)) return

  // Los costados, apenas velados cuando se ven: es lo que hace leer el corte como un plano.
  ctx.save()
  ctx.fillStyle = style.color
  ctx.globalAlpha = 0.14
  for (const plane of HEAD.planes) {
    if (!facing(plane[0]) || !plane.every((m) => inFront(m.p))) continue
    ctx.beginPath()
    plane.forEach((m, i) => {
      const [x, y] = toScreen(m.p)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.fill()
  }
  ctx.restore()

  const lines = [...HEAD.lines, ...silhouette(eye)]

  // Dos pasadas: el halo oscuro abajo, para que se lea sobre una cara clara, y la
  // línea encima.
  for (const pass of ['halo', 'line'] as const) {
    for (const visible of [false, true]) {
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = pass === 'halo' ? style.halo : style.color
      const w = visible ? style.width : style.width * 0.7
      ctx.lineWidth = pass === 'halo' ? w + 2 : w
      ctx.globalAlpha = visible ? (pass === 'halo' ? 0.5 : 1) : pass === 'halo' ? 0.2 : 0.45
      if (!visible) ctx.setLineDash([style.width * 2.5, style.width * 3])
      ctx.beginPath()
      for (const line of lines) {
        let open = false
        for (let i = 0; i < line.length; i++) {
          const show = facing(line[i]) === visible && inFront(line[i].p)
          const [x, y] = toScreen(line[i].p)
          if (show && open) ctx.lineTo(x, y)
          else if (show) {
            // Arrancar desde el punto anterior, para que no queden huecos donde cambia.
            if (i > 0) {
              const [px, py] = toScreen(line[i - 1].p)
              ctx.moveTo(px, py)
              ctx.lineTo(x, y)
            } else ctx.moveTo(x, y)
            open = true
          } else open = false
        }
      }
      ctx.stroke()
      ctx.restore()
    }
  }
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function normalize(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2])
  return [a[0] / l, a[1] / l, a[2] / l]
}
