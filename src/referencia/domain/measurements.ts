import { computeGrid } from './grid'
import { drawingArea } from './paper'
import type { AppState } from '../types'

export interface Subject {
  width: number
  height: number
}

const cm = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 })

/**
 * La línea de medidas que se escribe al pie del export en hoja.
 *
 * Va ahí y no en un panel porque es el dato que se consulta con la hoja apoyada en
 * la mesa, lejos de la pantalla. Y es una sola línea a propósito: la hoja impresa no
 * se sale de escala, así que lo único que la vuelve utilizable es saber a qué
 * tamaño hay que llevar cada casilla.
 */
export function captionLines(subject: Subject, state: AppState): string[] {
  const aspect = subject.width / subject.height
  const lines = computeGrid(state.grid, aspect)
  const area = drawingArea(state.paper, aspect)
  const out: string[] = []

  if (area) out.push(`Dibujo: ${cm(area.w)} × ${cm(area.h)} cm`)
  if (lines) {
    out.push(`Grilla: ${lines.cols} × ${lines.rows} · ${lines.cols * lines.rows} casillas`)
    if (area) {
      out.push(`Casilla: ${cm(lines.cellW * area.w)} × ${cm(lines.cellH * area.h)} cm`)
    }
  }

  return out
}
