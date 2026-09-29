import type { ReactNode } from 'react'
import { copy } from '../../shared/copy'

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
      <h2 className="ds-sr">{title}</h2>
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
 * Los colores con nombre, en el orden del picker nuevo (Figma 26:425): Blanco,
 * Negro, Rosa, Celeste, Amarillo. "Otro" no está acá — lleva su propio input
 * de color y se agrega aparte, como `trailing` del `OptionPicker`.
 */
export const NAMED_COLORS = [
  { value: '#ffffff', name: copy.grid.colors.white },
  { value: '#111111', name: copy.grid.colors.black },
  { value: '#ff2d95', name: copy.grid.colors.pink },
  { value: '#00e5ff', name: copy.grid.colors.cyan },
  { value: '#ffd60a', name: copy.grid.colors.yellow },
]

/**
 * La tarjeta "Otro" (26:495): mismo dibujo que el resto del `OptionPicker`
 * pero con un `<input type="color">` invisible encima en vez de un valor
 * cerrado — el mismo truco que ya usaba `SwatchPicker`.
 */
export function CustomColorOption({
  value,
  selected,
  onChange,
  onClose,
}: {
  value: string
  selected: boolean
  onChange: (color: string) => void
  /**
   * Al perder el foco y no al elegir: el diálogo nativo del color dispara
   * `onChange` de a poco mientras se arrastra adentro de él, y cerrar esta
   * pantalla a mitad de eso le sacaría del medio al `<input>` que lo sostiene.
   */
  onClose: () => void
}) {
  return (
    <label className={'ds-option ds-option--any' + (selected ? ' is-selected' : '')}>
      <span className="ds-option-swatch ds-option-swatch--any" />
      <span>{copy.grid.customColor}</span>
      <input
        type="color"
        value={value}
        aria-label={copy.grid.customColor}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onClose}
      />
    </label>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="hint">{children}</p>
}
