import { useEffect, useRef } from 'react'
import { REST_LIGHT, rgba } from '../../render/light'
import { glossOf, shadeProfile } from '../../render/profile'
import { drawMaterial } from '../../render/textures'
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
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = SIZE * dpr
    canvas.height = SIZE * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, SIZE, SIZE)

    if (material && finish) {
      drawMaterial(ctx, { x: 0, y: 0, w: SIZE, h: SIZE }, false, color, material, finish, 11)

      // Mismo perfil que la moldura, corriendo de arriba abajo.
      const stops = shadeProfile('top', REST_LIGHT, glossOf(finish), profile ?? 'scoop')
      const g = ctx.createLinearGradient(0, 0, 0, SIZE)
      for (const s of stops) {
        g.addColorStop(
          s.t,
          s.shade >= 0
            ? rgba('#fff6e8', Math.min(0.72, s.shade * 0.62))
            : rgba('#07070c', Math.min(0.82, -s.shade * 0.72)),
        )
      }
      ctx.fillStyle = g
      ctx.fillRect(0, 0, SIZE, SIZE)
    } else {
      ctx.fillStyle = color
      ctx.fillRect(0, 0, SIZE, SIZE)
    }
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
