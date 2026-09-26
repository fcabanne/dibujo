import { ChevronDownIcon } from './icons'

export interface DropdownProps {
  /** Cómo se llama el campo. Va al lector de pantalla. */
  label: string
  /** Lo que está elegido ahora, ya traducido — el componente no sabe de idiomas. */
  value: string
  /** El cuadradito de color a la izquierda, solo para la fila de Color. */
  swatch?: string
  onClick: () => void
}

/**
 * La fila cerrada. Figma: `Dropdown` (23:193 · 23:243).
 *
 * No abre una lista adentro: toca esta fila y lleva a una pantalla completa
 * de tarjetas grandes (`OptionPicker`), como en el archivo. No hay diseño de
 * un menú flotante en el archivo, así que acá no se inventa uno.
 */
export function Dropdown({ label, value, swatch, onClick }: DropdownProps) {
  return (
    <button type="button" className="ds-dropdown" onClick={onClick} aria-label={label}>
      {swatch && <span className="ds-dropdown-swatch" style={{ background: swatch }} />}
      <span className="ds-dropdown-value">{value}</span>
      <span className="ds-dropdown-arrow">
        <ChevronDownIcon />
      </span>
    </button>
  )
}
