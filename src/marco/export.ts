import { copy } from '../shared/copy'
import type { Output } from '../shared/deliver'
import { computeLayout, fitScale } from './domain/geometry'
import { isGlActive, renderOffscreen } from './gl/offscreen'
import type { Parallax } from './render/frame'
import { eyeOf, REST_POSE } from './render/pose'
import { renderScene } from './render/scene'
import { standoff } from './render/shadow'
import type { AppState } from './types'

/**
 * La foto del cuadro colgado, para llevarse.
 *
 * No es una captura de la pantalla: la escena se vuelve a pintar entera en un lienzo
 * aparte, sin controles encima, sin el zoom con que se estaba mirando y con el
 * cuadro entero al medio. La luz sí es la de la pantalla —el paralaje del momento—:
 * lo que se descarga es lo que se estaba viendo.
 *
 * Un solo tamaño por dispositivo, sin preguntar: en el celular 9:16, para una
 * historia o un reel; en la compu 16:9, como la pantalla.
 *
 * El lienzo lógico tiene el tamaño de una pantalla de verdad y se agranda con la
 * densidad, igual que el lienzo de la app con `devicePixelRatio`. Algunas cosas del
 * render están medidas en píxeles de pantalla —desenfoques, trazos finos—, y
 * pintadas directo a 1440 de ancho saldrían más nítidas y más finas que lo que se
 * ve en el teléfono.
 */
const SHOTS = {
  compact: { width: 405, height: 720, density: 1440 / 405 },
  wide: { width: 1280, height: 720, density: 2 },
}

const QUALITY = 0.92

export async function exportScene(
  state: AppState,
  parallax: Parallax,
  compact: boolean,
): Promise<Output> {
  const shot = compact ? SHOTS.compact : SHOTS.wide
  const image = await decode(state.artwork.src)

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(shot.width * shot.density)
  canvas.height = Math.round(shot.height * shot.density)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(copy.marco.downloadFailed)
  ctx.imageSmoothingQuality = 'high'
  ctx.setTransform(shot.density, 0, 0, shot.density, 0, 0)

  // En la compu, el mismo encaje de la pantalla. En el celular, más apretado que en
  // la app —ahí no hay cajón ni cartela que dejarles lugar—, apenas por encima del
  // medio, como cuelga un cuadro.
  const { outer } = computeLayout(state)
  const pxPerCm = compact
    ? Math.min((shot.width * 0.72) / outer.w, (shot.height * 0.54) / outer.h)
    : fitScale(outer, shot.width, shot.height)

  // Si el cuadro se está viendo en 3D, la foto también: la pared en 2D y el cuadro
  // encima, pintado por el mismo 3D en un lienzo aparte del tamaño de la foto.
  const gl = isGlActive()
  const { rects, layout } = renderScene(ctx, state, image, {
    width: shot.width,
    height: shot.height,
    pxPerCm,
    dpr: shot.density,
    parallax,
    anchor: compact ? { x: shot.width / 2, y: shot.height * 0.46 } : undefined,
    objectArea: gl ? null : undefined,
  })
  if (gl) {
    const object = renderOffscreen({
      state,
      rects,
      pose: REST_POSE,
      pxPerCm,
      dpr: shot.density,
      width: shot.width,
      height: shot.height,
      eye: eyeOf(parallax),
      image,
      hasFrame: state.frame.width > 0,
      hasMat: Boolean(state.mats[0]?.enabled),
      depthCm: layout.depth,
      wallCm: layout.depth + standoff(layout.outer.h) / 2,
      standoffCm: standoff(layout.outer.h),
    })
    if (object) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(object, 0, 0, canvas.width, canvas.height)
    } else {
      // Si el 3D no anduvo justo ahora, la foto sale entera en 2D.
      renderScene(ctx, state, image, {
        width: shot.width,
        height: shot.height,
        pxPerCm,
        dpr: shot.density,
        parallax,
        anchor: compact ? { x: shot.width / 2, y: shot.height * 0.46 } : undefined,
      })
    }
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  )
  if (!blob) throw new Error(copy.marco.downloadFailed)
  return { blob, filename: `${fileName(state.artwork.title)}.jpg` }
}

function decode(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(copy.marco.downloadFailed))
    img.src = src
  })
}

/** El título de la obra, sin lo que un sistema de archivos no acepta. */
function fileName(title: string): string {
  const clean = title
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return clean || copy.marco.fileName
}
