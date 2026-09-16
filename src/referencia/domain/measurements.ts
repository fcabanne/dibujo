import { copy, fill, formatDecimal } from '../../shared/copy'
import { computeGrid } from './grid'
import { drawingArea } from './paper'
import type { AppState } from '../types'

export interface Subject {
  width: number
  height: number
}

/**
 * La línea de medidas que se escribe al pie del export en hoja.
 *
 * Va ahí y no en un panel porque es el dato que se consulta con la hoja apoyada en
 * la mesa, lejos de la pantalla. Y es una sola línea a propósito: la hoja impresa no
 * sale a escala, así que lo único que la vuelve utilizable es saber a qué tamaño hay
 * que llevar cada casilla.
 *
 * Las tres frases salen del archivo de textos con sus valores adentro, y no armadas
 * a pedazos acá: el orden de las partes cambia de un idioma a otro.
 */
export function captionLines(subject: Subject, state: AppState): string[] {
  const aspect = subject.width / subject.height
  const lines = computeGrid(state.grid, aspect)
  const area = drawingArea(state.paper, aspect)
  const out: string[] = []

  if (area) {
    out.push(
      fill(copy.caption.drawing, {
        width: formatDecimal(area.w),
        height: formatDecimal(area.h),
      }),
    )
  }

  if (lines) {
    out.push(
      fill(copy.caption.grid, {
        cols: lines.cols,
        rows: lines.rows,
        total: lines.cols * lines.rows,
      }),
    )
    if (area) {
      out.push(
        fill(copy.caption.cell, {
          width: formatDecimal(lines.cellW * area.w),
          height: formatDecimal(lines.cellH * area.h),
        }),
      )
    }
  }

  return out
}
