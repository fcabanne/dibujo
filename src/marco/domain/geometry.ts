import type { AppState, Layout, Rect, Size } from '../types'

/**
 * Labio del passe-partout que pisa el borde de la obra para sostenerla.
 * Media práctica de taller; cambia la medida de la ventana que se encarga.
 */
export const MAT_OVERLAP = 0.5

/** Espesor del sándwich vidrio + obra + respaldo cuando no hay marco. */
export const CLIPPED_DEPTH = 0.6

/**
 * El espesor de la moldura, fijo. Se podía elegir, pero es lo que menos se decide y
 * lo que menos se nota en el cuadro terminado: se mide de canto, y la casa de cuadros
 * lo resuelve con el perfil. Un control que casi no cambia nada es un control de más.
 * Lo que se guardó en sesiones viejas se pisa con este valor al abrir.
 */
export const FRAME_DEPTH = 1

export const LIMITS = {
  frameWidth: { min: 0, max: 10, step: 0.5 },
  matWidth: { min: 1, max: 15, step: 0.5 },
  artSide: { min: 5, max: 200 },
} as const

/**
 * Las cuatro medidas que deciden todo el cuadro, en cm y como cuelga (con la obra ya
 * girada): la obra, el passe-partout y la moldura. Cero es "no hay".
 *
 * Existen aparte del estado porque lo que se ve no siempre es lo que se encarga: el
 * estado guarda la medida redondeada, y el lienzo dibuja una que la persigue con un
 * resorte. Las dos pasan por la misma cuenta (`layoutFromDims`), así que no pueden
 * desencontrarse.
 */
export interface Dims {
  artW: number
  artH: number
  mat: number
  frame: number
}

export function dimsOf(state: AppState): Dims {
  const { artwork, frame } = state
  const rotated = artwork.rotation === 90 || artwork.rotation === 270
  const mat = state.mats[0]
  return {
    artW: rotated ? artwork.size.h : artwork.size.w,
    artH: rotated ? artwork.size.w : artwork.size.h,
    mat: mat?.enabled ? mat.width : 0,
    frame: frame.width,
  }
}

/**
 * Resuelve toda la geometría del cuadro, en cm, desde afuera hacia adentro.
 *
 * Con un passe-partout de verdad (desde 1 cm) y una moldura de verdad la cuenta es la
 * de siempre. Por debajo, el labio que pisa la obra y el espesor se achican con la
 * medida: un passe-partout que se va a cero se encoge hasta desaparecer, en vez de
 * cerrar de golpe la ventana medio centímetro por lado.
 */
export function layoutFromDims(d: Dims): Layout {
  const art: Size = { w: d.artW, h: d.artH }
  const mat = Math.max(0, d.mat)
  const frame = Math.max(0, d.frame)

  // El passe-partout tapa MAT_OVERLAP por lado, así que la luz es menor que la obra.
  const overlap = MAT_OVERLAP * Math.min(1, mat / LIMITS.matWidth.min)
  const sight: Size = { w: art.w - 2 * overlap, h: art.h - 2 * overlap }
  const glass: Size = { w: sight.w + 2 * mat, h: sight.h + 2 * mat }
  const outer: Size = { w: glass.w + 2 * frame, h: glass.h + 2 * frame }

  // Sin marco queda el sándwich con ganchitos; el espesor pasa de uno al otro en el
  // primer medio centímetro de moldura.
  const t = Math.min(1, frame / 0.5)

  return {
    art,
    sight,
    glass,
    outer,
    diagonal: Math.hypot(outer.w, outer.h),
    depth: CLIPPED_DEPTH + (FRAME_DEPTH - CLIPPED_DEPTH) * t,
  }
}

export function computeLayout(state: AppState): Layout {
  return layoutFromDims(dimsOf(state))
}

/** Centra un tamaño en cm alrededor de un punto en px. */
export function centeredRect(size: Size, cx: number, cy: number, pxPerCm: number): Rect {
  const w = size.w * pxPerCm
  const h = size.h * pxPerCm
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

/**
 * Escala que hace entrar el cuadro dejando aire para la sombra y para el HUD.
 * El llamador interpola hacia este valor para que el cambio no salte.
 */
export function fitScale(outer: Size, viewW: number, viewH: number): number {
  const usableW = viewW * 0.52
  const usableH = viewH * 0.66
  return Math.min(usableW / outer.w, usableH / outer.h)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}


export interface SceneRects {
  outer: Rect
  glass: Rect
  sight: Rect
  center: { x: number; y: number }
}

export interface Viewport {
  width: number
  height: number
}

/**
 * Único lugar donde el cuadro se ubica en pantalla.
 *
 * Lo consumen el render y la capa de interacción: los gizmos y las burbujas se
 * anclan a estos mismos rectángulos. Si cada uno hiciera su propia cuenta, la manija
 * terminaría corrida respecto del marco que dibuja.
 */
export function composeRects(
  layout: { outer: Size; glass: Size; sight: Size },
  view: Viewport,
  pxPerCm: number,
  /** Centro del cuadro, si no es el de siempre. Lo usa el celular. */
  anchor?: { x: number; y: number },
): SceneRects {
  // Centrado: la cartela cuelga a un costado pero no corre el cuadro, que es lo
  // que se está mirando. El paralaje tampoco lo corre: lo que se mueve al cambiar de
  // punto de vista es la pared de atrás (ver `wallShift`), y así el cuadro no se
  // escapa de abajo del puntero que lo quiere agarrar.
  const cx = anchor?.x ?? view.width / 2
  // Apenas por encima del centro: así cuelga un cuadro a la altura de la vista.
  const cy = anchor?.y ?? view.height * 0.45

  return {
    outer: centeredRect(layout.outer, cx, cy, pxPerCm),
    glass: centeredRect(layout.glass, cx, cy, pxPerCm),
    sight: centeredRect(layout.sight, cx, cy, pxPerCm),
    center: { x: cx, y: cy },
  }
}

/**
 * Imán a la grilla. El gizmo devuelve valores continuos, y un marco de 9,4267 cm no
 * se puede encargar: redondear a medio centímetro es lo que hace que la medida que
 * sale de arrastrar sirva para la casa de cuadros.
 */
export function snap(value: number, step: number): number {
  return Math.round(value / step) * step
}
