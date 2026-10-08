import type { DetectedFace } from './detect'
import { drawLoomis } from './loomis'
import { MEDIAPIPE_VFOV, fitLens, focalPx, rescale, solvePose, type Camera, type Pose } from './pose'

/**
 * Las cabezas de una foto, listas para pintar en cualquier tamaño.
 *
 * Se calculan una vez en los píxeles de la imagen donde se detectaron (`width` ×
 * `height`), y se pintan en el rectángulo que toque —la pantalla, un export de seis
 * mil píxeles, la hoja de la mesa de luz— con una escala uniforme. Es la misma idea
 * que la grilla en fracciones: una sola cuenta, y todos los destinos la comparten.
 */
export interface HeadScene {
  width: number
  height: number
  cam: Camera
  poses: Pose[]
}

/** Las poses de cada cara con una lente: la de MediaPipe como punto de partida, ajustada. */
export function solveHeads(
  faces: DetectedFace[],
  mm: number,
  width: number,
  height: number,
): HeadScene {
  const f = focalPx(mm, width, height)
  const startF = height / 2 / Math.tan(MEDIAPIPE_VFOV / 2)
  const cam = { f, cx: width / 2, cy: height / 2 }
  const poses = faces.map((face) => solvePose(face.points, cam, rescale(face.start, startF, f)).pose)
  return { width, height, cam, poses }
}

/** La lente que mejor explica las caras de la foto (ver `fitLens`). */
export function estimateLens(faces: DetectedFace[], width: number, height: number): number {
  return fitLens(faces, { f: 1, cx: width / 2, cy: height / 2 }, width, height)
}

export interface HeadPaintStyle {
  color: string
  /** 0..1 */
  opacity: number
  /** El grosor de la línea, ya en píxeles del destino. */
  lineWidth: number
}

/**
 * Pinta las cabezas dentro de `rect`, que tiene la proporción de la foto, con el
 * mismo trazo que la grilla: liso, de un color, sin halo. Lo de atrás de la bola va
 * como la subdivisión, a mitad de opacidad y de grosor.
 */
export function paintHeads(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  scene: HeadScene,
  style: HeadPaintStyle,
): void {
  if (!scene.poses.length || style.opacity <= 0) return
  ctx.save()
  ctx.translate(rect.x, rect.y)
  ctx.beginPath()
  ctx.rect(0, 0, rect.w, rect.h)
  ctx.clip()
  ctx.globalAlpha = style.opacity
  const scale = rect.w / scene.width
  for (const pose of scene.poses) {
    drawLoomis(ctx, scene.cam, pose, scale, { color: style.color, halo: null, width: style.lineWidth })
  }
  ctx.restore()
}
