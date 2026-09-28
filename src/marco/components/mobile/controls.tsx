import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { copy, formatDecimal } from '../../../shared/copy'
import { paintMoldingChip, type ChipLook } from '../../render/chip'
import type { FrameFinish, FrameMaterial, FrameProfile } from '../../types'

/**
 * Las piezas con que se arman los cajones del celular. Los controles de verdad
 * —slider, botones de elegir, muestras, tarjetas— son del sistema de diseño
 * (`shared/ui`); lo que queda acá es cómo se acomodan, y las dos cosas que el
 * sistema no tiene porque son de este oficio: la muestra con la moldura pintada y
 * la muestra de "sin".
 */

/**
 * El nombre de un grupo, y a veces lo que tiene elegido: "COLOR · NOGAL". El nombre
 * del color importa acá más que en ninguna otra herramienta: "nogal" es la palabra
 * que se le dice al enmarcador.
 */
export function Heading({ label, value }: { label: string; value?: string }) {
  return (
    <p className="m-heading">
      <span>{label}</span>
      {value && (
        // `key` para que el nombre nuevo entre con su animación cada vez que cambia.
        <em key={value}>{value}</em>
      )}
    </p>
  )
}

/** Nombre a la izquierda, control a la derecha, como la fila de Referencia. */
export function Row({
  label,
  disabled,
  children,
}: {
  label: string
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <div className={'m-row' + (disabled ? ' is-disabled' : '')}>
      <span className="m-row-name">{label}</span>
      {children}
    </div>
  )
}

/**
 * Una tira de muestras que se corre de costado. Se busca un color pasando el dedo
 * por la tira y mirando el cuadro, que es lo que se hace frente a la pared de
 * muestras de una casa de cuadros.
 *
 * Al abrir, la elegida queda a la vista: con diez colores, la que está puesta puede
 * haber quedado fuera de la tira. El borde derecho se desvanece para que se note
 * que sigue.
 */
export function Strip({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const strip = ref.current
    const chosen = strip?.querySelector<HTMLElement>('.is-selected')
    if (!strip || !chosen) return
    const left = chosen.offsetLeft - (strip.clientWidth - chosen.offsetWidth) / 2
    strip.scrollLeft = Math.max(0, left)
  }, [])

  return (
    <div ref={ref} className="m-strip" role="group" aria-label={label}>
      {children}
    </div>
  )
}

/**
 * La muestra de "sin": sin marco, sin passe-partout. Va primera en su tira, como
 * "Sin vidrio" va primero entre los vidrios: no tener es una opción de enmarcado
 * más, no un apagado escondido en otro lado.
 */
export function NoneSwatch({
  label,
  selected,
  onSelect,
}: {
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={'ds-swatch m-swatch-none' + (selected ? ' is-selected' : '')}
      title={label}
      aria-label={label}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span />
    </button>
  )
}

/**
 * La muestra de una moldura: el círculo del sistema (`.ds-swatch`) con la madera,
 * el metal o la pintura pintados adentro, con el mismo perfil que el marco. Elegir
 * nogal es elegir cómo se ve el nogal, no un marrón.
 */
export function MoldingSwatch({
  label,
  color,
  material,
  finish,
  profile,
  selected,
  onSelect,
}: {
  label: string
  color: string
  material: FrameMaterial
  finish: FrameFinish
  profile: FrameProfile
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={'ds-swatch m-swatch-molding' + (selected ? ' is-selected' : '')}
      title={label}
      aria-label={label}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span>
        <MoldingChip
          color={color}
          material={material}
          finish={finish}
          profile={profile}
          look="face"
          size={36}
        />
      </span>
    </button>
  )
}

/**
 * La moldura pintada, sola. La usan las muestras y las tarjetas de acabado y perfil.
 * Las muestras de color la miran de frente (`face`), porque ahí lo que importa es el
 * color; las tarjetas de perfil, de costado, porque ahí importa la forma.
 */
export function MoldingChip({
  color,
  material,
  finish,
  profile,
  look = 'face',
  size = 32,
}: {
  color: string
  material: FrameMaterial
  finish: FrameFinish
  profile: FrameProfile
  look?: ChipLook
  size?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (ref.current) paintMoldingChip(ref.current, size, color, material, finish, profile, look)
  }, [color, material, finish, profile, look, size])

  return <canvas ref={ref} className="m-chip" style={{ width: size, height: size }} aria-hidden />
}

/**
 * Un campo de centímetros.
 *
 * Es de texto y no `type="number"`: en un teléfono en castellano el teclado ofrece
 * la coma, y un campo numérico la rechaza en silencio. Mientras se escribe se
 * respeta lo que se tipeó —acotar en cada tecla hacía imposible escribir "1" camino
 * a "18"— y cada valor que ya se puede leer se aplica, así el cuadro acompaña. Al
 * salir se acota y se reescribe prolijo.
 */
export function CmField({
  value,
  label,
  onType,
  onCommit,
}: {
  value: number
  label: string
  onType: (value: number) => void
  onCommit: (value: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)

  const parse = (raw: string) => Number(raw.replace(',', '.').trim())

  return (
    // La unidad va adentro del campo, como en Referencia: se escribe 30 y ya dice 30 cm.
    <span className="m-unit" data-unit={copy.marco.unit}>
      <input
        type="text"
        inputMode="decimal"
        enterKeyHint="done"
        className="m-field"
        aria-label={label}
        value={draft ?? formatDecimal(value)}
        onFocus={(e) => {
          setDraft(formatDecimal(value))
          e.currentTarget.select()
        }}
        onChange={(e) => {
          setDraft(e.target.value)
          const next = parse(e.target.value)
          if (e.target.value && Number.isFinite(next) && next > 0) onType(next)
        }}
        onBlur={(e) => {
          onCommit(parse(e.target.value))
          setDraft(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
    </span>
  )
}
