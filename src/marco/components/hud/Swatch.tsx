import { useEffect, useRef } from 'react'
import { paintMoldingChip } from '../../render/chip'
import type { FrameFinish, FrameMaterial, FrameProfile } from '../../types'

interface Props {
  label: string
  color: string
  selected: boolean
  onClick: () => void
  /** Se llama al entrar y salir con el puntero, para previsualizar la opción. */
  onHover?: (on: boolean) => void
  material?: FrameMaterial
  finish?: FrameFinish
  profile?: FrameProfile
  /**
   * Nombre visible bajo el swatch. Lo usan los acabados y los perfiles: comparten
   * el color del marco actual, así que sin el nombre parecen colores repetidos.
   */
  caption?: string
}

const SIZE = 46

/**
 * El swatch se pinta con el mismo material y el mismo perfil que la moldura del
 * lienzo, así que lo que elegís es exactamente lo que vas a ver enmarcado — incluida
 * la forma de la sección, que en un círculo de color plano no se distinguiría.
 */
export function Swatch({
  label,
  color,
  selected,
  onClick,
  onHover,
  material,
  finish,
  profile,
  caption,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (ref.current) paintMoldingChip(ref.current, SIZE, color, material, finish, profile)
  }, [color, material, finish, profile])

  return (
    <button
      type="button"
      className={'swatch' + (selected ? ' is-selected' : '') + (caption ? ' has-caption' : '')}
      onClick={onClick}
      onPointerEnter={() => onHover?.(true)}
      onPointerLeave={() => onHover?.(false)}
      title={label}
      aria-label={label}
      aria-pressed={selected}
    >
      <canvas ref={ref} />
      {caption && <strong>{caption}</strong>}
    </button>
  )
}
