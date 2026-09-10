import type { AppState, Layout } from '../types'

export interface Measurement {
  label: string
  value: string
}

const cm = (n: number) => `${n.toFixed(1).replace('.', ',')} cm`
const pair = (w: number, h: number) => `${cm(w)} × ${cm(h)}`

/**
 * Las medidas que se le dictan al enmarcador, en el orden en que se arma el cuadro:
 * de la obra hacia afuera. Van sobre la pared como la cartela de un museo, así que
 * es una lista corta a propósito — la diagonal y la lista de corte volverán con la
 * ficha exportable, donde tienen dónde vivir sin ensuciar la escena.
 */
export function buildMeasurements(state: AppState, layout: Layout): Measurement[] {
  const mat = state.mats[0]
  const rows: Measurement[] = [{ label: 'Obra', value: pair(layout.art.w, layout.art.h) }]

  if (mat?.enabled) {
    rows.push({ label: 'Passe-partout', value: `${cm(mat.width)} por lado` })
  }

  rows.push({ label: 'Vidrio', value: pair(layout.glass.w, layout.glass.h) })

  if (state.frame.width > 0) {
    rows.push({ label: 'Marco', value: pair(layout.outer.w, layout.outer.h) })
    rows.push({ label: 'Moldura', value: `${cm(state.frame.width)} × ${cm(layout.depth)}` })
  }

  return rows
}

export function formatCm(n: number): string {
  return cm(n)
}
