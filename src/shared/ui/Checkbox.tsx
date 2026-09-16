import { useId } from 'react'

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** El texto que va al lado. Se dibuja. */
  label: string
  /** Una aclaración debajo del texto, si hace falta. */
  hint?: string
  disabled?: boolean
}

/**
 * La casilla del sistema. Figma: `Property 1=Default` / `Variant2` (4:1270).
 *
 * Adentro hay un `<input type="checkbox">` de verdad, escondido pero no
 * removido: es lo que hace que ande con el teclado, que el lector de
 * pantalla lo anuncie como casilla, y que tocar el texto la marque. El
 * cuadradito dibujado es decoración encima de eso.
 */
export function Checkbox({ checked, onChange, label, hint, disabled }: CheckboxProps) {
  const id = useId()

  return (
    <div className={'ds-checkbox' + (disabled ? ' is-disabled' : '')}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id}>
        <span className="ds-checkbox-text">
          {label}
          {hint && <em>{hint}</em>}
        </span>
        <span className="ds-checkbox-box" aria-hidden="true" />
      </label>
    </div>
  )
}
