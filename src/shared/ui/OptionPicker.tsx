import type { ReactNode } from 'react'

export interface PickerOption<T extends string> {
  value: T
  label: string
  icon: ReactNode
  /** Ocupa las dos columnas — Figma 26:411 ("Ninguna"). */
  wide?: boolean
}

export interface OptionPickerProps<T extends string> {
  /** El título de arriba: "Tipo" o "Color". */
  label: string
  value: T
  options: PickerOption<T>[]
  /** Tipo va de a dos (26:279); Color va de a tres (26:425). */
  columns: 2 | 3
  onChange: (value: T) => void
  /**
   * Una tarjeta más al final de la grilla que no es un valor fijo — la de
   * "Otro" color (26:495), que lleva su propio `<input type="color">` adentro
   * en vez de un valor cerrado.
   */
  trailing?: ReactNode
}

/**
 * La pantalla completa de tarjetas grandes en la que se elige Tipo o Color.
 * Figma: 26:279 (Tipo) / 26:425 (Color).
 *
 * Reemplaza el contenido del panel entero mientras está abierta — no es un
 * menú flotante, es una pantalla propia — y se cierra sola al elegir.
 */
export function OptionPicker<T extends string>({
  label,
  value,
  options,
  columns,
  onChange,
  trailing,
}: OptionPickerProps<T>) {
  return (
    <div className="ds-option-picker">
      <p className="ds-option-header">{label}</p>
      <div className={`ds-option-grid ds-option-grid--${columns}`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={
              'ds-option' +
              (option.value === value ? ' is-selected' : '') +
              (option.wide ? ' is-wide' : '')
            }
            onClick={() => onChange(option.value)}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        ))}
        {trailing}
      </div>
    </div>
  )
}
