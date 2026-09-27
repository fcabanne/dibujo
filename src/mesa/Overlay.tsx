import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { copy, fill } from '../shared/copy'
import { fitQuad, isConvex, perspective, type Point, type Quad } from './corners'

interface Props {
  src: string
  opacity: number
  /** Dónde quedaron las esquinas; `null` es la foto encajada. */
  corners: Quad | null
  /** El tamaño de la pantalla, en píxeles. */
  stage: { w: number; h: number }
  onChange: (corners: Quad) => void
}

/**
 * Cuánto se separa la manija de su esquina, en píxeles.
 *
 * La manija no va **sobre** la esquina sino afuera, en diagonal: si fuera
 * encima, el dedo taparía justo el punto que se está tratando de calzar. Así la
 * esquina queda a la vista mientras se la arrastra, y la precisión la pone el
 * ojo y no la yema.
 */
const REACH = 34

/** Lo más cerca del borde que puede quedar una manija: medio dedo. */
const EDGE = 26

type Drag =
  | { kind: 'corner'; index: number; start: Point; from: Quad; pointer: number }
  | { kind: 'move'; start: Point; from: Quad; pointer: number }

/**
 * La foto encima de la cámara, deformada a sus cuatro esquinas.
 *
 * Las manijas están siempre, sin un modo que haya que abrir y cerrar: calzar la
 * foto es lo primero que se hace y se retoca cada vez que se mueve la hoja. Se van
 * con el resto de la interfaz cuando nadie toca la pantalla (ver `.handles` en el
 * CSS), y ahí la foto vuelve a ser solo una imagen. Arrastrar la foto la mueve
 * entera.
 */
export function Overlay({ src, opacity, corners, stage, onChange }: Props) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const drag = useRef<Drag | null>(null)
  const [active, setActive] = useState<number | 'move' | null>(null)

  const quad = natural && (corners ?? fitQuad(natural, stage))
  const px = quad?.map((p) => ({ x: p.x * stage.w, y: p.y * stage.h })) as Quad | undefined

  const begin = (event: ReactPointerEvent, index: number | 'move') => {
    if (!quad) return
    event.preventDefault()
    event.stopPropagation()
    ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
    const start = { x: event.clientX, y: event.clientY }
    drag.current =
      index === 'move'
        ? { kind: 'move', start, from: quad, pointer: event.pointerId }
        : { kind: 'corner', index, start, from: quad, pointer: event.pointerId }
    setActive(index)
  }

  const follow = (event: ReactPointerEvent) => {
    const current = drag.current
    if (!current || current.pointer !== event.pointerId) return
    // El movimiento es relativo: la esquina se corre lo que se corre el dedo, sin
    // saltar a donde apoyó. Es lo que permite agarrarla de cualquier lado de la
    // manija y ajustar de a un píxel.
    let dx = (event.clientX - current.start.x) / stage.w
    let dy = (event.clientY - current.start.y) / stage.h

    if (current.kind === 'move') {
      // Entera, sin que ninguna esquina se vaya de la pantalla.
      const xs = current.from.map((p) => p.x)
      const ys = current.from.map((p) => p.y)
      dx = clamp(dx, -Math.min(...xs), 1 - Math.max(...xs))
      dy = clamp(dy, -Math.min(...ys), 1 - Math.max(...ys))
      onChange(current.from.map((p) => ({ x: p.x + dx, y: p.y + dy })) as Quad)
      return
    }

    const next = current.from.slice() as Quad
    const p = current.from[current.index]
    next[current.index] = { x: clamp(p.x + dx, 0, 1), y: clamp(p.y + dy, 0, 1) }
    // Si la foto se daría vuelta, la esquina se queda donde estaba.
    if (isConvex(next)) onChange(next)
  }

  const end = (event: ReactPointerEvent) => {
    if (drag.current?.pointer !== event.pointerId) return
    drag.current = null
    setActive(null)
  }

  return (
    <>
      <img
        className="overlay"
        src={src}
        alt=""
        draggable={false}
        onLoad={(event) =>
          setNatural({
            w: event.currentTarget.naturalWidth,
            h: event.currentTarget.naturalHeight,
          })
        }
        style={
          natural && px
            ? {
                width: natural.w,
                height: natural.h,
                opacity,
                transform: perspective(natural.w, natural.h, px),
              }
            : { visibility: 'hidden' }
        }
      />

      {px && quad && (
        <svg
          className="handles"
          width={stage.w}
          height={stage.h}
          data-active={active ?? undefined}
          onPointerMove={follow}
          onPointerUp={end}
          onPointerCancel={end}
        >
          {/* La foto entera es la manija de moverla. Un solo dedo y sin modo aparte:
              adentro mueve todo, en una esquina mueve esa. */}
          <polygon
            className="handles-body"
            points={px.map((p) => `${p.x},${p.y}`).join(' ')}
            onPointerDown={(event) => begin(event, 'move')}
          />

          {px.map((corner, index) => {
            const knob = reach(corner, px, stage)
            return (
              <g
                key={index}
                className={'handle' + (active === index ? ' is-active' : '')}
                role="slider"
                aria-label={fill(copy.mesa.corner, { n: index + 1 })}
                aria-valuetext={`${Math.round(quad[index].x * 100)}%, ${Math.round(quad[index].y * 100)}%`}
                onPointerDown={(event) => begin(event, index)}
              >
                <line x1={corner.x} y1={corner.y} x2={knob.x} y2={knob.y} />
                {/* La mira: el punto exacto que se está llevando a la marca. */}
                <path
                  className="handle-aim"
                  d={`M${corner.x - 7},${corner.y}H${corner.x + 7}M${corner.x},${corner.y - 7}V${corner.y + 7}`}
                />
                <circle className="handle-hit" cx={knob.x} cy={knob.y} r={EDGE} />
                <circle className="handle-knob" cx={knob.x} cy={knob.y} r={13} />
              </g>
            )
          })}
        </svg>
      )}
    </>
  )
}

/**
 * Dónde va la manija de una esquina: hacia afuera de la foto, en la dirección que
 * la aleja del centro, y sin salirse de la pantalla.
 */
function reach(corner: Point, quad: Quad, stage: { w: number; h: number }): Point {
  const center = {
    x: quad.reduce((sum, p) => sum + p.x, 0) / 4,
    y: quad.reduce((sum, p) => sum + p.y, 0) / 4,
  }
  const dx = corner.x - center.x
  const dy = corner.y - center.y
  const length = Math.hypot(dx, dy) || 1
  return {
    x: clamp(corner.x + (dx / length) * REACH, EDGE, stage.w - EDGE),
    y: clamp(corner.y + (dy / length) * REACH, EDGE, stage.h - EDGE),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

