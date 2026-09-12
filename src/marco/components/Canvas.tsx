import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clamp,
  computeLayout,
  fitScale,
  LIMITS,
  snap,
  type SceneRects,
} from '../domain/geometry'
import { loadArtworkFile } from '../../shared/imageFile'
import { draggableTarget, grabDistance, hitZone, type Zone } from '../interaction/zones'
import { useImage } from '../hooks/useImage'
import { luminance } from '../render/light'
import { renderScene } from '../render/scene'
import { wallLumaAt } from '../render/wall'
import type { Action } from '../state/reducer'
import type { AppState, Layout } from '../types'

/** Lo que el overlay necesita cada frame para anclar burbujas y gizmos. */
export interface SceneSnapshot {
  rects: SceneRects | null
  zone: Zone
  dragging: 'frame' | 'mat' | null
  /** Ancho en curso mientras se arrastra, para mostrarlo sobre el gizmo. */
  dragCm: number | null
  hasFrame: boolean
  hasMat: boolean
  /**
   * Brillo 0..1 estimado de la pared donde va la cartela. No alcanza con el
   * color elegido: ahí cae la penumbra del foco, así que una pared blanca puede ser
   * oscura justo en ese punto y el texto negro desaparecería.
   */
  wallLuma: number
  /** El puntero estuvo activo hace poco: gobierna si el HUD se muestra. */
  awake: boolean
}

interface Props {
  state: AppState
  dispatch: (action: Action) => void
  sceneRef: React.MutableRefObject<SceneSnapshot>
  onLayout: (layout: Layout) => void
  onArtworkDropped: (src: string, aspect: number) => void
  onAwakeChange: (awake: boolean) => void
}

/**
 * El HUD se apaga si el puntero se va del lienzo, si la ventana pierde el foco, o
 * si se queda quieto. Mientras haya un abanico abierto no se apaga: el overlay lo
 * mantiene visible por su cuenta, así que parar a elegir no lo hace desaparecer.
 */
const LEAVE_MS = 320
const IDLE_MS = 2000

/** Cuánto deja alejar y acercar la rueda. */
const VIEW_ZOOM = { min: 0.45, max: 2.2 }

interface DragState {
  target: 'frame' | 'mat'
  startWidth: number
  startDist: number
  /** Escala congelada: si se reajustara al crecer, el cuadro se escapa del cursor. */
  frozenScale: number
}

export function Canvas({
  state,
  dispatch,
  sceneRef,
  onLayout,
  onArtworkDropped,
  onAwakeChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const image = useImage(state.artwork.src)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scaleRef = useRef<number | null>(null)
  const pointerRef = useRef({ x: 0, y: 0, inside: false })
  const parallaxRef = useRef({ x: 0, y: 0 })
  const dragRef = useRef<DragState | null>(null)
  const sleepRef = useRef(0)
  const wallLumaRef = useRef(0.5)
  /**
   * Zoom de cámara, no de la obra: acerca o aleja la escena entera. Vive en un ref
   * y no en el estado porque es cómo estás mirando, no cómo va a quedar el cuadro,
   * y no tiene por qué guardarse con el proyecto.
   */
  const viewZoomRef = useRef(1)

  const stateRef = useRef(state)
  const imageRef = useRef(image)
  const onLayoutRef = useRef(onLayout)
  const onAwakeRef = useRef(onAwakeChange)
  const dispatchRef = useRef(dispatch)
  stateRef.current = state
  imageRef.current = image
  onLayoutRef.current = onLayout
  onAwakeRef.current = onAwakeChange
  dispatchRef.current = dispatch

  // --- loop de render -------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    let frame = 0
    let last = performance.now()

    const loop = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now

      const ctx = canvas.getContext('2d')
      const box = wrap.getBoundingClientRect()

      if (ctx && box.width > 0 && box.height > 0) {
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        const dw = Math.round(box.width * dpr)
        const dh = Math.round(box.height * dpr)
        if (canvas.width !== dw || canvas.height !== dh) {
          canvas.width = dw
          canvas.height = dh
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        const current = stateRef.current
        const layout = computeLayout(current)

        // Escala: persigue el encaje, salvo mientras arrastrás.
        const drag = dragRef.current
        const target = drag
          ? drag.frozenScale
          : fitScale(layout.outer, box.width, box.height) * viewZoomRef.current

        if (scaleRef.current === null) scaleRef.current = target
        else {
          const k = 1 - Math.exp(-dt / 70)
          scaleRef.current += (target - scaleRef.current) * k
          if (Math.abs(target - scaleRef.current) < 0.01) scaleRef.current = target
        }

        // Paralaje: el puntero normalizado a -1..1, suavizado. Al salir vuelve al centro.
        const p = pointerRef.current
        const aimX = p.inside ? clamp((p.x / box.width) * 2 - 1, -1, 1) : 0
        const aimY = p.inside ? clamp((p.y / box.height) * 2 - 1, -1, 1) : 0
        const kp = 1 - Math.exp(-dt / 130)
        parallaxRef.current.x += (aimX - parallaxRef.current.x) * kp
        parallaxRef.current.y += (aimY - parallaxRef.current.y) * kp

        const { layout: drawn, rects, light } = renderScene(ctx, current, imageRef.current, {
          width: box.width,
          height: box.height,
          pxPerCm: scaleRef.current,
          dpr,
          parallax: parallaxRef.current,
        })

        const hasFrame = current.frame.width > 0
        const hasMat = Boolean(current.mats[0]?.enabled)
        const zone = p.inside ? hitZone(p, rects, hasFrame, hasMat) : 'wall'

        wallLumaRef.current = wallLumaAt(
          rects.outer.x + rects.outer.w + 110,
          rects.outer.y + rects.outer.h * 0.4,
          rects.outer,
          light,
          luminance(current.wall.color),
        )

        const dragging = dragRef.current?.target ?? null
        sceneRef.current = {
          rects,
          zone,
          dragging,
          dragCm: dragging
            ? dragging === 'frame'
              ? current.frame.width
              : hasMat
                ? current.mats[0].width
                : 0
            : null,
          hasFrame,
          hasMat,
          wallLuma: wallLumaRef.current,
          awake: sceneRef.current.awake,
        }
        onLayoutRef.current(drawn)
      }

      frame = requestAnimationFrame(loop)
    }

    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [sceneRef])

  // --- puntero --------------------------------------------------------------
  // A nivel ventana para que el paralaje no se congele al pasar por una burbuja.
  useEffect(() => {
    const sleepAfter = (ms: number) => {
      window.clearTimeout(sleepRef.current)
      sleepRef.current = window.setTimeout(() => {
        if (dragRef.current) return
        onAwakeRef.current(false)
        sceneRef.current.awake = false
      }, ms)
    }

    const onMove = (e: PointerEvent) => {
      const box = wrapRef.current?.getBoundingClientRect()
      if (!box) return
      const x = e.clientX - box.left
      const y = e.clientY - box.top
      const inside = x >= 0 && y >= 0 && x <= box.width && y <= box.height
      pointerRef.current = { x, y, inside }

      if (inside) {
        onAwakeRef.current(true)
        sceneRef.current.awake = true
        sleepAfter(IDLE_MS)
      } else {
        sleepAfter(LEAVE_MS)
      }

      const drag = dragRef.current
      const rects = sceneRef.current.rects
      if (!drag || !rects) return

      const dist = grabDistance({ x, y }, rects)
      const delta = (dist - drag.startDist) / drag.frozenScale
      const raw = drag.startWidth + delta

      if (drag.target === 'frame') {
        const width = clamp(
          snap(raw, LIMITS.frameWidth.step),
          LIMITS.frameWidth.min,
          LIMITS.frameWidth.max,
        )
        dispatchRef.current({ type: 'frame/patch', patch: { width } })
      } else {
        // Por debajo del mínimo el passe-partout no se encoge: se apaga.
        const width = clamp(snap(raw, LIMITS.matWidth.step), 0, LIMITS.matWidth.max)
        dispatchRef.current({
          type: 'mat/patch',
          patch:
            width < LIMITS.matWidth.min
              ? { enabled: false }
              : { enabled: true, width },
        })
      }
    }

    const onUp = () => {
      dragRef.current = null
      sceneRef.current.dragging = null
      sceneRef.current.dragCm = null
    }

    // Al perder el foco el HUD se va de inmediato: si volvés a la ventana y el
    // puntero quedó quieto encima, no tendría por qué seguir mostrándose.
    const onBlur = () => {
      pointerRef.current.inside = false
      sleepAfter(0)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('blur', onBlur)
      window.clearTimeout(sleepRef.current)
    }
  }, [sceneRef])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const rects = sceneRef.current.rects
      if (!rects || !scaleRef.current) return

      const box = wrapRef.current?.getBoundingClientRect()
      if (!box) return
      const p = { x: e.clientX - box.left, y: e.clientY - box.top }
      const current = stateRef.current

      // La zona se resuelve desde el evento, no desde la que calculó el último
      // frame: apretar sin haber movido antes dejaría una zona vieja.
      const target = draggableTarget(
        hitZone(p, rects, current.frame.width > 0, Boolean(current.mats[0]?.enabled)),
      )
      if (!target) return

      dragRef.current = {
        target,
        startWidth:
          target === 'frame'
            ? current.frame.width
            : current.mats[0]?.enabled
              ? current.mats[0].width
              : 0,
        startDist: grabDistance(p, rects),
        frozenScale: scaleRef.current,
      }
      sceneRef.current.dragging = target
      e.preventDefault()
    },
    [sceneRef],
  )

  // La rueda acerca y aleja la escena. Mientras arrastrás no hace nada: la escala
  // está congelada a propósito para que el cuadro no se escape del cursor.
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (dragRef.current) return
    viewZoomRef.current = clamp(
      viewZoomRef.current * Math.exp(-e.deltaY * 0.0011),
      VIEW_ZOOM.min,
      VIEW_ZOOM.max,
    )
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const { src, aspect } = await loadArtworkFile(file)
        onArtworkDropped(src, aspect)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar la imagen')
        window.setTimeout(() => setError(null), 3200)
      }
    },
    [onArtworkDropped],
  )

  const zone = sceneRef.current.zone
  const cursor = dragRef.current
    ? 'grabbing'
    : draggableTarget(zone)
      ? 'grab'
      : 'default'

  return (
    <div
      ref={wrapRef}
      className={'canvas-wrap' + (dragOver ? ' is-dragging' : '')}
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onWheel={onWheel}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) void handleFile(file)
      }}
    >
      <canvas ref={canvasRef} />
      {dragOver && (
        <div className="drop-hint">
          <span>Soltá tu dibujo acá</span>
        </div>
      )}
      {error && <div className="canvas-error">{error}</div>}
    </div>
  )
}
