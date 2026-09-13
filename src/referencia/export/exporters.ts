import { aspectOf, baseName, decodeFull, type Reference } from '../../shared/referenceImage'
import { captionLines } from '../domain/measurements'
import { cmToPoints, printSheet, SAFE_MARGIN } from '../domain/paper'
import { createEffects, isNeutral } from '../render/effects'
import { drawCaptionOnSheet } from '../render/grid'
import { paintScene } from '../render/scene'
import { jpegToPdf } from './pdf'
import type { AppState, SheetId } from '../types'

export interface Output {
  blob: Blob
  filename: string
}

/** Densidad de impresión. 300 puntos por pulgada es lo que ya no se ve como puntos. */
const DPI = 300

/**
 * Techo de píxeles para la hoja. Un A2 a 300 dpi son treinta y cinco millones de
 * píxeles, y cada uno cuesta cuatro bytes de memoria mientras se dibuja: pasado
 * cierto punto el navegador devuelve un lienzo en blanco sin avisar. Antes que eso,
 * baja la densidad.
 */
const MAX_SHEET_PIXELS = 36_000_000

const QUALITY = 0.95

/** Lo que se va a escribir en el archivo, antes de elegir con qué formato. */
interface Page {
  canvas: HTMLCanvasElement
  /** Sufijo para el nombre del archivo. */
  label: string
  /** Tamaño de la página del PDF, en puntos PostScript. */
  points: { w: number; h: number }
}

/**
 * El único camino de salida: la foto con los ajustes y la grilla encima, al tamaño y
 * en el formato que se hayan elegido.
 */
export async function exportFile(ref: Reference, state: AppState): Promise<Output> {
  const aspect = aspectOf(ref)
  const image = await decodeFull(ref)
  const effects = isNeutral(state.effects) ? null : createEffects()

  try {
    const photo = effects ? effects.apply(image, ref.width, ref.height, state.effects) : image
    const page =
      state.export.size === 'original'
        ? renderOriginal(ref, state, aspect, photo)
        : renderSheet(ref, state, aspect, photo)

    return await write(page, baseName(ref.name), state.export.format)
  } finally {
    effects?.dispose()
  }
}

/** La foto con sus propios píxeles, ni uno más ni uno menos. */
function renderOriginal(
  ref: Reference,
  state: AppState,
  aspect: number,
  photo: CanvasImageSource,
): Page {
  const canvas = document.createElement('canvas')
  canvas.width = ref.width
  canvas.height = ref.height
  paintScene(context(canvas), { x: 0, y: 0, w: ref.width, h: ref.height }, photo, state, aspect)

  return {
    canvas,
    label: '',
    // Sin hoja que declarar, la página se toma como la foto impresa a 300 dpi.
    points: { w: (ref.width * 72) / DPI, h: (ref.height * 72) / DPI },
  }
}

/**
 * La hoja lista para imprimir: papel blanco, la foto lo más grande que entre dentro
 * de los márgenes, y las medidas al pie.
 *
 * La foto **no** sale a escala del dibujo final, y es a propósito: el dibujo puede
 * ser un A2 y la impresora de casa llegar hasta A4. Lo que la vuelve utilizable no
 * es que esté a escala sino que diga cuánto mide cada casilla en el papel de verdad,
 * y eso está escrito encima y al pie.
 */
function renderSheet(
  ref: Reference,
  state: AppState,
  aspect: number,
  photo: CanvasImageSource,
): Page {
  const sheet = printSheet(state.export.size as SheetId, aspect)
  const fit = Math.min(1, Math.sqrt(MAX_SHEET_PIXELS / sheetPixels(sheet)))
  const pxPerCm = (DPI / 2.54) * fit

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(sheet.w * pxPerCm)
  canvas.height = Math.round(sheet.h * pxPerCm)
  const ctx = context(canvas)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Lo más grande que entre entre los márgenes, centrado.
  const scale = Math.min(
    Math.max(1, sheet.w - SAFE_MARGIN * 2) / aspect,
    Math.max(1, sheet.h - SAFE_MARGIN * 2),
  )
  const w = scale * aspect
  paintScene(
    ctx,
    {
      x: (sheet.w - w) * 0.5 * pxPerCm,
      y: (sheet.h - scale) * 0.5 * pxPerCm,
      w: w * pxPerCm,
      h: scale * pxPerCm,
    },
    photo,
    state,
    aspect,
  )

  // En el margen de abajo, que es papel vacío: acá hay dónde ponerlas sin taparle
  // nada al dibujo.
  drawCaptionOnSheet(
    ctx,
    SAFE_MARGIN * pxPerCm,
    canvas.height - SAFE_MARGIN * 0.45 * pxPerCm,
    (sheet.w - SAFE_MARGIN * 2) * pxPerCm,
    captionLines(ref, state),
    Math.max(10, SAFE_MARGIN * 0.32 * pxPerCm),
  )

  return { canvas, label: `-${sheet.label}`, points: { w: cmToPoints(sheet.w), h: cmToPoints(sheet.h) } }
}

/**
 * El PDF lleva adentro el mismo JPEG que se descargaría suelto: el filtro DCTDecode
 * acepta la imagen ya comprimida, así que no se paga ninguna vuelta extra de
 * calidad por elegir PDF.
 */
async function write(page: Page, name: string, format: AppState['export']['format']) {
  const jpeg = await toBlob(page.canvas, 'image/jpeg', QUALITY)
  const filename = `${name}-referencia${page.label}`

  if (format === 'jpg') return { blob: jpeg, filename: `${filename}.jpg` }

  const bytes = new Uint8Array(await jpeg.arrayBuffer())
  return {
    blob: jpegToPdf(bytes, page.canvas.width, page.canvas.height, page.points.w, page.points.h),
    filename: `${filename}.pdf`,
  }
}

export function download({ blob, filename }: Output): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Con un respiro: revocarla en el mismo tic cancela la descarga en algunos navegadores.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function sheetPixels(sheet: { w: number; h: number }): number {
  const perCm = DPI / 2.54
  return sheet.w * perCm * (sheet.h * perCm)
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar el lienzo del export')
  ctx.imageSmoothingQuality = 'high'
  return ctx
}

function toBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar el archivo'))),
      mime,
      quality,
    )
  })
}

