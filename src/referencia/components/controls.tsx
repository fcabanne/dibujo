import type { ReactNode } from 'react'
import { copy } from '../../shared/copy'

/**
 * Los controles del panel que **no están dibujados en Figma**: el slider, el
 * grupo de botones y los chips de color.
 *
 * No invento componentes nuevos para ellos. Toman los tokens del sistema
 * —color, tipografía, radio, medida— y su forma sale de la que el diseño sí
 * define: el grupo de botones repite el patrón de la barra de pestañas (una
 * píldora clara con el elegido en violeta), que es el único agrupador que
 * existe en el archivo.
 *
 * Cuando se dibujen, se reemplazan por componentes de `shared/ui`.
 * La casilla ya no está acá: es `Checkbox` del sistema.
 */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format?: (value: number) => string
  disabled?: boolean
}

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
    <label className={'slider' + (disabled ? ' is-off' : '')}>
      <span className="row">
        <span>{label}</span>
        <em>{format ? format(value) : String(value)}</em>
      </span>
      <span className="track">
        <span className="fill" style={{ width: `${ratio * 100}%` }} />
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
      </span>
    </label>
  )
}

interface Option<T> {
  value: T
  label: string
  title?: string
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  label?: string
}) {
  return (
    <div className="field">
      {label && <span className="field-label">{label}</span>}
      <div className="segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.title}
            className={option.value === value ? 'is-on' : ''}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Los colores que de verdad se usan encima de una foto, más el cuentagotas para el resto. */
const COLORS = ['#ffffff', '#111111', '#ff3b30', '#00e5ff', '#ffd60a', '#ff2d95']

export function ColorRow({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  const custom = !COLORS.includes(value.toLowerCase())
  return (
    <div className="field">
      <span className="field-label">{copy.grid.color}</span>
      <div className="colors">
        {COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={'chip' + (color === value.toLowerCase() ? ' is-on' : '')}
            style={{ background: color }}
            aria-label={color}
            aria-pressed={color === value.toLowerCase()}
            onClick={() => onChange(color)}
          />
        ))}
        <label className={'chip is-custom' + (custom ? ' is-on' : '')} title={copy.grid.customColor}>
          <span style={{ background: value }} />
          <input
            type="color"
            value={value}
            aria-label={copy.grid.customColor}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      </div>
    </div>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="hint">{children}</p>
}
