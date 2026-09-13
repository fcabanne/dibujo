import { columnLabel, type GridLines } from '../domain/grid'
import type { GridStyle } from '../types'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * El grosor se pide relativo y se resuelve acá, contra el ancho del destino. Así la
 * línea que ves sobre una vista previa de mil píxeles sale igual de gruesa en un
 * export de seis mil — que es la única forma de que la grilla impresa se parezca a
 * la que elegiste.
 */
const WEIGHT_REFERENCE_WIDTH = 1200

export function lineWidthFor(rect: Rect, style: GridStyle): number {
  return Math.max(0.6, (style.weight * rect.w) / WEIGHT_REFERENCE_WIDTH)
}

/**
 * Tamaño de todo lo que se escribe sobre la foto, etiquetas y cotas por igual.
 *
 * Se mide contra el ancho de la foto y **no** contra el tamaño de la casilla: si
 * escalara con la grilla, el mismo número saldría minúsculo con ocho divisiones y
 * descomunal con dos. Lo que se lee tiene que tener el mismo cuerpo siempre.
 */
function typeSize(rect: Rect): number {
  return Math.max(9, rect.w * 0.017)
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  lines: GridLines,
  style: GridStyle,
  /** Medida de una casilla en cm sobre el dibujo final, si se conoce. */
  cellSize: { w: number; h: number } | null,
): void {
  const lw = lineWidthFor(rect, style)

  // La subdivisión va primero y por debajo, a la mitad de todo. Es una ayuda para
  // afinar la puntería dentro de la casilla, no una grilla más: si compitiera en
  // peso con la principal, se perdería cuál es cuál.
  if (lines.subX.length || lines.subY.length) {
    // El piso de medio píxel es solo para la pantalla: en el export `lw` ya es
    // grande y manda la mitad. Sin el piso, en una vista previa chica la línea fina
    // se disuelve y el interruptor parecería no hacer nada.
    strokeLines(
      ctx,
      rect,
      lines.subX,
      lines.subY,
      style.color,
      style.opacity / 2,
      Math.max(0.5, lw / 2),
    )
  }

  strokeLines(ctx, rect, lines.x, lines.y, style.color, style.opacity, lw)

  ctx.save()
  ctx.globalAlpha = style.opacity
  ctx.strokeStyle = style.color
  ctx.lineWidth = lw
  // El borde va por dentro: media línea afuera se perdería al recortar el export.
  ctx.strokeRect(rect.x + lw / 2, rect.y + lw / 2, rect.w - lw, rect.h - lw)
  ctx.restore()

  const cotas = cellSize ? drawCellSize(ctx, rect, lines, style, cellSize) : false
  // La cota vive en la misma esquina que la "A" y el "1". Cuando está, esa esquina es
  // suya: la medida necesita llegar hasta el borde para que se entienda qué mide, y
  // dos cosas peleando por el mismo lugar no se leen ninguna.
  if (style.labels) drawLabels(ctx, rect, lines, style, cotas)
}

function strokeLines(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  xs: number[],
  ys: number[],
  color: string,
  alpha: number,
  width: number,
): void {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'butt'

  ctx.beginPath()
  for (const fx of xs) {
    const x = rect.x + fx * rect.w
    ctx.moveTo(x, rect.y)
    ctx.lineTo(x, rect.y + rect.h)
  }
  for (const fy of ys) {
    const y = rect.y + fy * rect.h
    ctx.moveTo(rect.x, y)
    ctx.lineTo(rect.x + rect.w, y)
  }
  ctx.stroke()
  ctx.restore()
}

/**
 * Las cotas de la casilla, adentro de A1: cuánto mide un cuadradito en el dibujo.
 *
 * Cada una va de punta a punta de lo que mide — del borde de la foto a la primera
 * línea de la grilla — porque una cota que no toca sus dos extremos no dice qué está
 * midiendo. Y va también en el export: la hoja impresa que apoyás en la mesa tiene
 * que poder decirte sola cuánto mide su propia grilla.
 *
 * Devuelve si se llegó a dibujar: en una casilla chica no entra, y entonces la
 * esquina le queda libre a las etiquetas.
 */
function drawCellSize(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  lines: GridLines,
  style: GridStyle,
  size: { w: number; h: number },
): boolean {
  const cw = lines.cellW * rect.w
  const ch = lines.cellH * rect.h
  const fs = typeSize(rect)
  if (cw < fs * 4.2 || ch < fs * 3.4) return false

  const off = fs * 0.95
  const tick = fs * 0.38
  const lw = Math.max(1, lineWidthFor(rect, style) * 0.7)
  const half = lw / 2

  const yLine = rect.y + off
  const xLine = rect.x + off
  const xEnd = rect.x + cw
  const yEnd = rect.y + ch

  ctx.save()
  ctx.globalAlpha = Math.max(style.opacity, 0.9)
  ctx.strokeStyle = style.color
  ctx.fillStyle = style.color
  ctx.lineWidth = lw
  ctx.lineCap = 'butt'

  ctx.beginPath()
  // Horizontal: del borde de la foto a la primera línea vertical, con topes en las dos puntas.
  ctx.moveTo(rect.x, yLine)
  ctx.lineTo(xEnd, yLine)
  ctx.moveTo(rect.x + half, yLine - tick)
  ctx.lineTo(rect.x + half, yLine + tick)
  ctx.moveTo(xEnd, yLine - tick)
  ctx.lineTo(xEnd, yLine + tick)
  // Vertical: del borde de arriba a la primera línea horizontal.
  ctx.moveTo(xLine, rect.y)
  ctx.lineTo(xLine, yEnd)
  ctx.moveTo(xLine - tick, rect.y + half)
  ctx.lineTo(xLine + tick, rect.y + half)
  ctx.moveTo(xLine - tick, yEnd)
  ctx.lineTo(xLine + tick, yEnd)
  ctx.stroke()

  ctx.font = font(fs)
  ctx.lineJoin = 'round'
  ctx.lineWidth = fs * 0.22
  ctx.strokeStyle = contrastTo(style.color)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const top = yLine + tick * 1.2
  label(ctx, cm(size.w), rect.x + cw / 2, top)

  // La vertical va al medio de su línea, salvo que ahí se choque con la de arriba:
  // en una casilla cuadrada las dos etiquetas caen casi en el mismo punto.
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const y = Math.min(yEnd - fs * 0.6, Math.max(rect.y + ch / 2, top + fs * 1.7))
  label(ctx, cm(size.h), xLine + tick * 1.2, y)

  ctx.restore()
  return true
}

/**
 * Letras arriba y números al costado. Van adentro de la foto y no en un margen
 * porque el export a tamaño original no tiene margen donde ponerlas: la foto sale
 * con las medidas que entró.
 */
function drawLabels(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  lines: GridLines,
  style: GridStyle,
  /** La primera casilla la ocupan las cotas: ahí no va ni la "A" ni el "1". */
  skipFirst: boolean,
): void {
  const size = typeSize(rect)
  const inset = size * 0.85
  const from = skipFirst ? 1 : 0

  ctx.save()
  ctx.font = font(size)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = size * 0.22
  ctx.strokeStyle = contrastTo(style.color)
  ctx.fillStyle = style.color
  ctx.globalAlpha = Math.max(style.opacity, 0.85)

  for (let i = from; i < lines.cols; i++) {
    const start = i * lines.cellW
    const end = Math.min(1, (i + 1) * lines.cellW)
    label(ctx, columnLabel(i), rect.x + ((start + end) / 2) * rect.w, rect.y + inset)
  }
  for (let i = from; i < lines.rows; i++) {
    const start = i * lines.cellH
    const end = Math.min(1, (i + 1) * lines.cellH)
    label(ctx, String(i + 1), rect.x + inset, rect.y + ((start + end) / 2) * rect.h)
  }

  ctx.restore()
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.strokeText(text, x, y)
  ctx.fillText(text, x, y)
}

const font = (size: number) =>
  `600 ${size}px 'Inter', system-ui, -apple-system, sans-serif`

const cm = (value: number) =>
  `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })} cm`

/** La misma línea de medidas, sobre el papel en blanco del export en hoja. */
export function drawCaptionOnSheet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  maxWidth: number,
  parts: string[],
  size: number,
): void {
  if (!parts.length) return
  const text = parts.join('   ·   ')
  ctx.save()
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(40, 40, 44, 0.9)'

  // Si no entra, achicamos la tipografía en vez de cortar el texto: el dato sirve
  // entero o no sirve.
  let fitted = size
  for (let i = 0; i < 6; i++) {
    ctx.font = `500 ${fitted}px 'Inter', system-ui, -apple-system, sans-serif`
    if (ctx.measureText(text).width <= maxWidth) break
    fitted *= 0.86
  }
  ctx.fillText(text, x, y)
  ctx.restore()
}

/** Blanco sobre líneas oscuras, negro sobre líneas claras: el halo que hace legible el número. */
function contrastTo(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16)
  if (Number.isNaN(n)) return '#000000'
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55 ? '#141414' : '#ffffff'
}
