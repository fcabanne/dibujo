import type { SceneRects } from '../domain/geometry'
import type { ArtworkState, FrameProfile, Rect } from '../types'
import { profileHeight } from '../render/profile'

/**
 * Las piezas del cuadro como mallas, en el espacio del cuadro en reposo: px de
 * pantalla en x e y, y z en px saliendo hacia el ojo, con el frente de la moldura en
 * z = 0. Se rearman en cada cuadro: son unas pocas centenas de vértices, y así las
 * medidas que llegan con resorte no piden nada especial.
 */

export interface Mesh {
  positions: number[]
  normals: number[]
  uvs: number[]
  indices: number[]
}

function mesh(): Mesh {
  return { positions: [], normals: [], uvs: [], indices: [] }
}

function vertex(m: Mesh, p: [number, number, number], n: [number, number, number], uv: [number, number]) {
  m.positions.push(...p)
  const len = Math.hypot(...n) || 1
  m.normals.push(n[0] / len, n[1] / len, n[2] / len)
  m.uvs.push(...uv)
  return m.positions.length / 3 - 1
}

function quad(m: Mesh, a: number, b: number, c: number, d: number) {
  m.indices.push(a, b, c, a, c, d)
}

interface Side {
  /** Esquina exterior donde arranca la pieza, y donde termina. */
  p0: [number, number]
  p1: [number, number]
  /** Hacia adentro del cuadro, y a lo largo de la pieza. */
  inward: [number, number]
  along: [number, number]
  /** Qué pedazo de la tabla le toca: cada listón muestra otra parte de la veta. */
  seed: number
}

function sidesOf(r: Rect): Side[] {
  const { x, y, w, h } = r
  return [
    { p0: [x, y], p1: [x + w, y], inward: [0, 1], along: [1, 0], seed: 11 },
    { p0: [x + w, y], p1: [x + w, y + h], inward: [-1, 0], along: [0, 1], seed: 29 },
    { p0: [x + w, y + h], p1: [x, y + h], inward: [0, -1], along: [-1, 0], seed: 47 },
    { p0: [x, y + h], p1: [x, y], inward: [1, 0], along: [0, -1], seed: 67 },
  ]
}

/** Las alturas del cuadro en px: dónde queda cada capa debajo del frente de la moldura. */
export interface Depths {
  /** Cuánto relieve tiene el perfil de la moldura. */
  relief: number
  /** Hasta dónde baja el canto de afuera de la moldura. */
  back: number
  glass: number
  mat: number
  art: number
}

export function depthsFor(pxPerCm: number, hasFrame: boolean): Depths {
  // Más hondo que una moldura promedio, como el 2D: a esta distancia un perfil real
  // se lee chato, y la forma es lo que hace que la luz tenga algo que recorrer.
  const relief = 1.5 * pxPerCm
  const rebate = hasFrame ? -0.62 * relief - 0.3 * pxPerCm : 0
  return {
    relief,
    back: -1.2 * pxPerCm,
    glass: rebate,
    mat: rebate - 0.05 * pxPerCm,
    art: rebate - 0.2 * pxPerCm,
  }
}

const PROFILE_SAMPLES = 28

/**
 * La moldura: el perfil levantado a lo ancho de cada listón, cortado a 45° en las
 * esquinas, con su canto de afuera y el labio de adentro que baja al rebaje. La
 * normal sale de la pendiente del perfil en cada punto: la luz cae sobre la forma, no
 * sobre un degradé pintado.
 */
export function frameMesh(rects: SceneRects, profile: FrameProfile, pxPerCm: number, d: Depths): Mesh {
  const m = mesh()
  const band = (rects.outer.w - rects.glass.w) / 2
  if (band <= 0.01) return m
  const z = (t: number) => (profileHeight(profile, t) - 1) * d.relief
  const cm = 1 / pxPerCm

  for (const side of sidesOf(rects.outer)) {
    const length = Math.hypot(side.p1[0] - side.p0[0], side.p1[1] - side.p0[1])
    const [ix, iy] = side.inward
    const [ax, ay] = side.along
    const row = (t: number) => {
      const dd = t * band
      const start: [number, number] = [side.p0[0] + ix * dd + ax * dd, side.p0[1] + iy * dd + ay * dd]
      const end: [number, number] = [side.p1[0] + ix * dd - ax * dd, side.p1[1] + iy * dd - ay * dd]
      const eps = 0.01
      const slope = (z(t + eps) - z(t - eps)) / (2 * eps * band)
      const n: [number, number, number] = [-slope * ix, -slope * iy, 1]
      const zz = z(t)
      const a = vertex(m, [start[0], start[1], zz], n, [(dd + side.seed * 7) * cm, dd * cm])
      const b = vertex(m, [end[0], end[1], zz], n, [(length - dd + side.seed * 7) * cm, dd * cm])
      return [a, b]
    }

    let prev = row(0)
    for (let j = 1; j <= PROFILE_SAMPLES; j++) {
      const next = row(j / PROFILE_SAMPLES)
      quad(m, prev[0], prev[1], next[1], next[0])
      prev = next
    }

    // El canto de afuera: de la cara hacia la pared.
    const out: [number, number, number] = [-ix, -iy, 0]
    const o0 = vertex(m, [side.p0[0], side.p0[1], z(0)], out, [side.seed * 7 * cm, 0])
    const o1 = vertex(m, [side.p1[0], side.p1[1], z(0)], out, [(length + side.seed * 7) * cm, 0])
    const o2 = vertex(m, [side.p1[0], side.p1[1], d.back], out, [(length + side.seed * 7) * cm, 1])
    const o3 = vertex(m, [side.p0[0], side.p0[1], d.back], out, [side.seed * 7 * cm, 1])
    quad(m, o0, o1, o2, o3)

    // El labio de adentro: de la cara hacia el rebaje, donde apoya el vidrio.
    const inner0: [number, number] = [side.p0[0] + (ix + ax) * band, side.p0[1] + (iy + ay) * band]
    const inner1: [number, number] = [side.p1[0] + (ix - ax) * band, side.p1[1] + (iy - ay) * band]
    const into: [number, number, number] = [ix, iy, 0]
    const i0 = vertex(m, [inner0[0], inner0[1], z(1)], into, [0, 0])
    const i1 = vertex(m, [inner1[0], inner1[1], z(1)], into, [length * cm, 0])
    const i2 = vertex(m, [inner1[0], inner1[1], d.glass - 0.2 * pxPerCm], into, [length * cm, 0.2])
    const i3 = vertex(m, [inner0[0], inner0[1], d.glass - 0.2 * pxPerCm], into, [0, 0.2])
    quad(m, i0, i1, i2, i3)
  }
  return m
}

/** El ancho del bisel del passe-partout, en cm: el corte a 45° de un cartón de 1,4 mm. */
const BEVEL = 0.2
const BOARD = 0.14

/**
 * El passe-partout: la cara del cartón alrededor de la ventana, y el corte a 45° que
 * deja ver el núcleo blanco. Son dos mallas porque son dos materiales.
 */
export function matMeshes(rects: SceneRects, pxPerCm: number, d: Depths): { face: Mesh; core: Mesh } {
  const face = mesh()
  const core = mesh()
  const cm = 1 / pxPerCm
  const b = Math.min(BEVEL * pxPerCm, (rects.glass.w - rects.sight.w) / 2)
  if (b <= 0.01) return { face, core }
  const th = BOARD * pxPerCm
  const win: Rect = { x: rects.sight.x - b, y: rects.sight.y - b, w: rects.sight.w + 2 * b, h: rects.sight.h + 2 * b }
  const outer = sidesOf(rects.glass)
  const window = sidesOf(win)
  const sight = sidesOf(rects.sight)

  for (let k = 0; k < 4; k++) {
    const o = outer[k]
    const w = window[k]
    const s = sight[k]
    const up: [number, number, number] = [0, 0, 1]
    const uv = (p: [number, number]): [number, number] => [p[0] * cm, p[1] * cm]
    const a = vertex(face, [o.p0[0], o.p0[1], d.mat], up, uv(o.p0))
    const bb = vertex(face, [o.p1[0], o.p1[1], d.mat], up, uv(o.p1))
    const c = vertex(face, [w.p1[0], w.p1[1], d.mat], up, uv(w.p1))
    const e = vertex(face, [w.p0[0], w.p0[1], d.mat], up, uv(w.p0))
    quad(face, a, bb, c, e)

    // El bisel: baja de la cara del cartón al borde de la ventana, mirando hacia adentro.
    const n: [number, number, number] = [th * s.inward[0], th * s.inward[1], b]
    const c0 = vertex(core, [w.p0[0], w.p0[1], d.mat], n, uv(w.p0))
    const c1 = vertex(core, [w.p1[0], w.p1[1], d.mat], n, uv(w.p1))
    const c2 = vertex(core, [s.p1[0], s.p1[1], d.mat - th], n, uv(s.p1))
    const c3 = vertex(core, [s.p0[0], s.p0[1], d.mat - th], n, uv(s.p0))
    quad(core, c0, c1, c2, c3)
  }
  return { face, core }
}

/**
 * La obra: un plano con la imagen llenando la ventana como en el 2D ("cover"), girada
 * si la obra está girada. `uv` es de la imagen.
 */
export function artMesh(rects: SceneRects, art: Rect, artwork: ArtworkState, aspect: number, d: Depths): Mesh {
  const m = mesh()
  const sight = rects.sight
  const rotated = artwork.rotation === 90 || artwork.rotation === 270
  const boxW = rotated ? sight.h : sight.w
  const boxH = rotated ? sight.w : sight.h
  // Cuánto de la imagen entra en la ventana, por lado, como fracción.
  const imgW = Math.max(boxW, boxH * aspect)
  const imgH = imgW / aspect
  const cx = sight.x + sight.w / 2
  const cy = sight.y + sight.h / 2
  const a = (-artwork.rotation * Math.PI) / 180
  const uvAt = (x: number, y: number): [number, number] => {
    // De la pantalla al sistema de la imagen sin girar.
    const dx = x - cx
    const dy = y - cy
    const rx = dx * Math.cos(a) - dy * Math.sin(a)
    const ry = dx * Math.sin(a) + dy * Math.cos(a)
    return [0.5 + rx / imgW, 0.5 + ry / imgH]
  }
  const n: [number, number, number] = [0, 0, 1]
  const p = [
    vertex(m, [art.x, art.y, d.art], n, uvAt(art.x, art.y)),
    vertex(m, [art.x + art.w, art.y, d.art], n, uvAt(art.x + art.w, art.y)),
    vertex(m, [art.x + art.w, art.y + art.h, d.art], n, uvAt(art.x + art.w, art.y + art.h)),
    vertex(m, [art.x, art.y + art.h, d.art], n, uvAt(art.x, art.y + art.h)),
  ]
  quad(m, p[0], p[1], p[2], p[3])
  return m
}

/** Un rectángulo plano, mirando al ojo: el vidrio. */
export function planeMesh(r: Rect, z: number): Mesh {
  const m = mesh()
  const n: [number, number, number] = [0, 0, 1]
  const p = [
    vertex(m, [r.x, r.y, z], n, [0, 0]),
    vertex(m, [r.x + r.w, r.y, z], n, [1, 0]),
    vertex(m, [r.x + r.w, r.y + r.h, z], n, [1, 1]),
    vertex(m, [r.x, r.y + r.h, z], n, [0, 1]),
  ]
  quad(m, p[0], p[1], p[2], p[3])
  return m
}
