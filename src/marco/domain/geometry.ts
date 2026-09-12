import type { AppState, Layout, Rect, Size } from '../types'

/**
 * Labio del passe-partout que pisa el borde de la obra para sostenerla.
 * Media práctica de taller; cambia la medida de la ventana que se encarga.
 */
export const MAT_OVERLAP = 0.5

/** Espesor del sándwich vidrio + obra + respaldo cuando no hay marco. */
export const CLIPPED_DEPTH = 0.6

export const LIMITS = {
  frameWidth: { min: 0, max: 10, step: 0.5 },
  frameDepth: { min: 0.5, max: 6, step: 0.5 },
  matWidth: { min: 1, max: 15, step: 0.5 },
  artSide: { min: 5, max: 200 },
} as const

/** Resuelve toda la geometría del cuadro, en cm, desde afuera hacia adentro. */
export function computeLayout(state: AppState): Layout {
  const { artwork, frame } = state
  const rotated = artwork.rotation === 90 || artwork.rotation === 270

  const art: Size = rotated
    ? { w: artwork.size.h, h: artwork.size.w }
    : { w: artwork.size.w, h: artwork.size.h }

  const mat = state.mats[0]
  const hasMat = Boolean(mat?.enabled)

  // El passe-partout tapa MAT_OVERLAP por lado, así que la luz es menor que la obra.
  const sight: Size = hasMat
    ? { w: art.w - 2 * MAT_OVERLAP, h: art.h - 2 * MAT_OVERLAP }
    : { ...art }

  const glass: Size = hasMat
    ? { w: sight.w + 2 * mat.width, h: sight.h + 2 * mat.width }
    : { ...art }

  const outer: Size = {
    w: glass.w + 2 * frame.width,
    h: glass.h + 2 * frame.width,
  }

  return {
    art,
    sight,
    glass,
    outer,
    diagonal: Math.hypot(outer.w, outer.h),
    depth: frame.width > 0 ? frame.depth : CLIPPED_DEPTH,
  }
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
  parallax: { x: number; y: number },
): SceneRects {
  // Centrado: la cartela cuelga a un costado pero no corre el cuadro, que es lo
  // que se está mirando. El paralaje lo desplaza apenas, en contra del puntero.
  const cx = view.width / 2 - parallax.x * 1.3
  // Apenas por encima del centro: así cuelga un cuadro a la altura de la vista.
  const cy = view.height * 0.45 - parallax.y * 0.9

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
