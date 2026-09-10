import type { ArtworkState, Rect } from '../types'

/**
 * La obra dentro de la luz. Siempre centrada (no hay pan) y recortada a la ventana.
 * La rotación gira el cuadro entero, así que acá solo se rota la imagen: la luz de
 * la escena se mantiene fija, como pasa al girar un cuadro colgado en la pared.
 */
export function drawArtwork(
  ctx: CanvasRenderingContext2D,
  sight: Rect,
  image: HTMLImageElement,
  artwork: ArtworkState,
) {
  if (!image.complete || image.naturalWidth === 0) return

  ctx.save()
  ctx.beginPath()
  ctx.rect(sight.x, sight.y, sight.w, sight.h)
  ctx.clip()

  // Papel debajo: si la imagen no cubre del todo, no se ve el fondo de la pared.
  ctx.fillStyle = '#efece4'
  ctx.fillRect(sight.x, sight.y, sight.w, sight.h)

  const cx = sight.x + sight.w / 2
  const cy = sight.y + sight.h / 2
  const rotated = artwork.rotation === 90 || artwork.rotation === 270

  // Al rotar, la ventana intercambia sus lados respecto del sistema de la imagen.
  const boxW = rotated ? sight.h : sight.w
  const boxH = rotated ? sight.w : sight.h

  // "cover": la obra llena la ventana; lo que sobra por proporción se recorta.
  const scale =
    Math.max(boxW / image.naturalWidth, boxH / image.naturalHeight)
  const w = image.naturalWidth * scale
  const h = image.naturalHeight * scale

  ctx.translate(cx, cy)
  if (artwork.rotation !== 0) ctx.rotate((artwork.rotation * Math.PI) / 180)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, -w / 2, -h / 2, w, h)
  ctx.restore()
}
