import type { ReactNode } from 'react'
import { copy } from '../../shared/copy'
import { Swatch, SwatchPicker } from '../../shared/ui'

/**
 * Cómo se **acomodan** los controles en este panel. Los controles en sí no
 * están acá: slider, stepper, botones de elegir, casilla y muestras de color
 * son componentes del sistema (`shared/ui`), porque están dibujados en Figma.
 *
 * Lo que queda acá es la caja alrededor: la sección de la columna de
 * escritorio, las dos formas de emparejar un nombre con su control, y los
 * textos sueltos.
 */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

/**
 * Nombre a la izquierda, control a la derecha. Es la fila del panel del
 * diseño (Figma 22:127, 22:584, 22:237…).
 *
 * En una sola línea entran más controles que apilando nombre y control, y en
 * un panel que se toca de corrido buscando un punto eso es lo que decide si
 * hay que scrollear entre dos perillas que se comparan entre sí.
 */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field-row">
      <span className="field-name">{label}</span>
      {children}
    </div>
  )
}

/**
 * Nombre arriba, control abajo. Para el diálogo de descarga, donde las
 * opciones son largas —"Original", "A4", "Oficio"— y no queda media fila
 * para ellas.
 */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
    </div>
  )
}

/**
 * Los colores que de verdad se usan encima de una foto, en el orden del
 * diseño (Figma 22:341), más la rueda para cualquier otro.
 *
 * Cada uno con su nombre: un círculo de color no dice nada para quien no lo
 * ve, y un hexadecimal tampoco.
 */
const COLORS = [
  { value: '#ffffff', name: copy.grid.colors.white },
  { value: '#111111', name: copy.grid.colors.black },
  { value: '#ff3b30', name: copy.grid.colors.red },
  { value: '#00e5ff', name: copy.grid.colors.cyan },
  { value: '#ffd60a', name: copy.grid.colors.yellow },
  { value: '#ff2d95', name: copy.grid.colors.pink },
]

export function ColorRow({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  const current = value.toLowerCase()
  const custom = !COLORS.some((color) => color.value === current)

  return (
    <div className="swatches" role="group" aria-label={copy.grid.color}>
      {COLORS.map((color) => (
        <Swatch
          key={color.value}
          color={color.value}
          label={color.name}
          selected={color.value === current}
          onSelect={() => onChange(color.value)}
        />
      ))}
      <SwatchPicker
        value={value}
        selected={custom}
        label={copy.grid.customColor}
        onChange={onChange}
      />
    </div>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="hint">{children}</p>
}
