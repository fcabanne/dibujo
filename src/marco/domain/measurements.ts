import { copy, fill, formatNumber } from '../../shared/copy'
import type { AppState, Layout } from '../types'

export interface Measurement {
  label: string
  value: string
}

const cm = (n: number) =>
  fill(copy.marco.cm, {
    n: formatNumber(n, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false }),
  })
const pair = (w: number, h: number) => fill(copy.marco.measure.pair, { w: cm(w), h: cm(h) })

/**
 * Las medidas que se le dictan al enmarcador, en el orden en que se arma el cuadro:
 * de la obra hacia afuera. Van sobre la pared como la cartela de un museo, así que
 * es una lista corta a propósito — la diagonal y la lista de corte volverán con la
 * ficha exportable, donde tienen dónde vivir sin ensuciar la escena.
 */
export function buildMeasurements(state: AppState, layout: Layout): Measurement[] {
  const mat = state.mats[0]
  const rows: Measurement[] = [{ label: copy.marco.measure.art, value: pair(layout.art.w, layout.art.h) }]

  if (mat?.enabled) {
    rows.push({ label: copy.marco.measure.mat, value: fill(copy.marco.measure.matSide, { size: cm(mat.width) }) })
  }

  rows.push({ label: copy.marco.measure.glass, value: pair(layout.glass.w, layout.glass.h) })

  if (state.frame.width > 0) {
    rows.push({ label: copy.marco.measure.frame, value: pair(layout.outer.w, layout.outer.h) })
    rows.push({ label: copy.marco.measure.molding, value: fill(copy.marco.measure.pair, { w: cm(state.frame.width), h: cm(layout.depth) }) })
  }

  return rows
}

export function formatCm(n: number): string {
  return cm(n)
}
