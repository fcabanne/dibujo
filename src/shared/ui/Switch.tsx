import { useId } from 'react'

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** No se dibuja: va al lector de pantalla, como en `Slider` y `Stepper`. */
  label: string
  disabled?: boolean
}

/**
 * El interruptor de sí/no. **No viene de Figma** — no hay un frame dibujado
 * para él todavía. Un rectángulo con un cuadrado adentro que se corre de un
 * lado al otro: la misma familia que `Slider` (relleno plano, sin píldora)
 * pero más chico y de dos posiciones en vez de un rango.
 *
 * Mismo truco de accesibilidad que `Checkbox`: adentro hay un
 * `<input type="checkbox">` de verdad, escondido pero no removido.
 */
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  const id = useId()

  return (
    <span className={'ds-switch' + (disabled ? ' is-disabled' : '')}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id} aria-label={label}>
        <span className="ds-switch-track" aria-hidden="true">
          <span className="ds-switch-thumb" />
        </span>
      </label>
    </span>
  )
}
