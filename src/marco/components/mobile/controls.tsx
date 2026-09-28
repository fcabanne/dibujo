import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { paintMoldingChip, type ChipLook } from '../../render/chip'
import { paintWallChip } from '../../render/textures'
import type { FrameFinish, FrameMaterial, FrameProfile, WallPattern } from '../../types'

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
 * Un pedazo de pared, con el color puesto y la textura acercada: en la tarjeta tiene
 * que verse qué textura es, que en la escena —a la escala del cuadro— es sutil.
 */
export function WallChip({ color, pattern }: { color: string; pattern: WallPattern }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (ref.current) paintWallChip(ref.current, 72, 44, color, pattern)
  }, [color, pattern])

  return <canvas ref={ref} className="m-wall-chip" style={{ width: 72, height: 44 }} aria-hidden />
}

/**
 * Lo que en el cajón parece un campo pero no abre el teclado ahí: lo abre en el
 * editor a pantalla completa (`FieldEditor`). Escribir adentro del cajón con el
 * teclado encima tapaba el campo y achicaba el cuadro a nada.
 */
export function FieldButton({
  value,
  label,
  unit,
  placeholder,
  onEdit,
}: {
  value: string
  label: string
  unit?: string
  placeholder?: boolean
  onEdit: () => void
}) {
  return (
    <span className="m-unit" data-unit={unit}>
      <button
        type="button"
        className={'m-field m-field-button' + (placeholder ? ' is-placeholder' : '')}
        aria-label={label}
        onClick={onEdit}
      >
        <span className="m-field-text">{value}</span>
      </button>
    </span>
  )
}
