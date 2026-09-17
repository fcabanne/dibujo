import type { CSSProperties } from 'react'

export interface SliderProps {
  /**
   * Cómo se llama. En el diseño el nombre se dibuja **afuera**, en la fila del
   * panel; acá va al lector de pantalla, que no ve la fila.
   */
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  /** Cómo se escribe el valor adentro de la píldora. Por defecto, el número. */
  format?: (value: number) => string
  disabled?: boolean
}

/**
 * El slider del sistema. Figma: `Slider` (22:276).
 *
 * No tiene manija: el control **es** el relleno, y el valor va escrito en el
 * medio. Es más fácil de tocar que un riel con una bolita —toda la píldora
 * responde, no solo 18 px de ella— y muestra el número sin gastar una línea
 * aparte para mostrarlo.
 *
 * Abajo hay un `<input type="range">` de verdad, transparente y del tamaño de
 * la píldora. Es lo que hace que ande con el teclado y que el lector de
 * pantalla lo anuncie como lo que es. El dibujo va encima.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  disabled,
}: SliderProps) {
  const ratio = max === min ? 0 : (value - min) / (max - min)

  return (
    <div
      className={'ds-slider' + (disabled ? ' is-disabled' : '')}
      style={{ '--ds-fill': ratio } as CSSProperties}
    >
      <span className="ds-slider-fill" aria-hidden="true" />
      <span className="ds-slider-value">{format ? format(value) : String(value)}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
