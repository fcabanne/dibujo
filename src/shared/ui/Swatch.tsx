export interface SwatchProps {
  color: string
  selected: boolean
  onSelect: () => void
  /** Cómo se llama el color. Un círculo de color no tiene nombre para quien no lo ve. */
  label: string
}

/**
 * Una muestra de color. Figma: `Colo Swatch` (22:352), variante `Any`.
 *
 * El color va adentro de un círculo claro y no pegado al borde: así una
 * muestra blanca sobre el fondo claro sigue siendo un círculo y no un agujero.
 * Elegida, se le dibuja un aro negro por dentro del borde.
 */
export function Swatch({ color, selected, onSelect, label }: SwatchProps) {
  return (
    <button
      type="button"
      className={'ds-swatch' + (selected ? ' is-selected' : '')}
      title={label}
      aria-label={label}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span style={{ background: color }} />
    </button>
  )
}

export interface SwatchPickerProps {
  value: string
  selected: boolean
  onChange: (color: string) => void
  label: string
}

/**
 * La muestra que abre el selector de color del sistema operativo. Figma:
 * `Colo Swatch` (22:406), variante `Swatch`.
 *
 * Dibuja siempre la rueda y no el color elegido, igual que en el archivo: es
 * la puerta a "cualquier otro", y el color que está puesto ya se ve sobre la
 * foto. Adentro hay un `<input type="color">` de verdad, escondido.
 */
export function SwatchPicker({ value, selected, onChange, label }: SwatchPickerProps) {
  return (
    <label
      className={'ds-swatch ds-swatch--any' + (selected ? ' is-selected' : '')}
      title={label}
    >
      <span aria-hidden="true" />
      <input
        type="color"
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
