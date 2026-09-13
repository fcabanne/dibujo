import { useCallback, useEffect, useRef, useState } from 'react'
import { aspectOf, type Reference } from '../../shared/referenceImage'
import { createEffects, type EffectsRenderer } from '../render/effects'
import { fitRect, paintScene } from '../render/scene'
import type { AppState } from '../types'

interface Props {
  reference: Reference | null
  state: AppState
  onFile: (file: File) => void
  /** Se avisa una vez si la máquina no puede correr los efectos. */
  onEffectsSupport: (supported: boolean) => void
}

const ZOOM = { min: 0.4, max: 8 }
/** Aire alrededor de la foto, para que la grilla no muera contra el borde de la ventana. */
const PAD = 32

interface View {
  zoom: number
  x: number
  y: number
}

export function Canvas({ reference, state, onFile, onEffectsSupport }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const effectsRef = useRef<EffectsRenderer | null>(null)
  const photoRef = useRef<CanvasImageSource | null>(null)
  const viewRef = useRef<View>({ zoom: 1, x: 0, y: 0 })
  /** Lo último que se dibujó, para poder anclar el zoom al puntero. */
  const placedRef = useRef({ x: 0, y: 0, w: 0, h: 0 })
  const frameRef = useRef(0)
  const panRef = useRef<{ x: number; y: number } | null>(null)

  const stateRef = useRef(state)
  const refRef = useRef(reference)
  stateRef.current = state
  refRef.current = reference

  const [zoomed, setZoomed] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  /**
   * Se dibuja cuando cambia algo y no sesenta veces por segundo: acá no hay nada
   * animado, y un loop permanente sería tener la placa encendida mirando una foto
   * quieta.
   */
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const current = refRef.current
    if (!canvas || !wrap) return

    const box = wrap.getBoundingClientRect()
    if (box.width < 2 || box.height < 2) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const dw = Math.round(box.width * dpr)
    const dh = Math.round(box.height * dpr)
    if (canvas.width !== dw || canvas.height !== dh) {
      canvas.width = dw
      canvas.height = dh
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, box.width, box.height)

    const photo = photoRef.current
    if (!current || !photo) return

    const aspect = aspectOf(current)
    const view = viewRef.current
    const base = fitRect(aspect, { w: box.width - PAD * 2, h: box.height - PAD * 2 })
    const w = base.w * view.zoom
    const h = base.h * view.zoom
    const rect = {
      x: (box.width - w) / 2 + view.x,
      y: (box.height - h) / 2 + view.y,
      w,
      h,
    }
    placedRef.current = rect

    ctx.imageSmoothingQuality = 'high'
    paintScene(ctx, rect, photo, stateRef.current, aspect)
  }, [])

  const schedule = useCallback(() => {
    if (frameRef.current) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0
      draw()
    })
  }, [draw])

  // Los efectos se recalculan solo cuando cambian ellos o la foto. Es el paso caro
  // del cuadro: mover la grilla no tiene por qué volver a pasar la foto por el shader.
  useEffect(() => {
    if (!reference) {
      photoRef.current = null
      schedule()
      return
    }
    if (!effectsRef.current) {
      effectsRef.current = createEffects()
      onEffectsSupport(effectsRef.current !== null)
    }
    const { preview } = reference
    photoRef.current = effectsRef.current
      ? effectsRef.current.apply(preview, preview.width, preview.height, state.effects)
      : preview
    schedule()
  }, [reference, state.effects, schedule, onEffectsSupport])

  // Cualquier otro cambio —grilla, color, medidas— solo repinta.
  useEffect(schedule, [state, schedule])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const observer = new ResizeObserver(schedule)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [schedule])

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current)
      // Volver a cero no es cosmético: `schedule` usa este ref como candado, y si
      // queda con el número de un cuadro ya cancelado no vuelve a pedir ninguno.
      frameRef.current = 0
      effectsRef.current?.dispose()
      effectsRef.current = null
    },
    [],
  )

  // Al cambiar de foto, la vista vuelve a encuadrar sola: el zoom de la anterior no
  // tiene por qué tener sentido en la nueva.
  useEffect(() => {
    viewRef.current = { zoom: 1, x: 0, y: 0 }
    setZoomed(false)
  }, [reference])

  const reset = useCallback(() => {
    viewRef.current = { zoom: 1, x: 0, y: 0 }
    setZoomed(false)
    schedule()
  }, [schedule])

  // Rueda: la foto se acerca hacia donde está el puntero, no hacia el centro. Con
  // una grilla de treinta y dos divisiones es la diferencia entre mirar un detalle y
  // buscarlo.
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const wrap = wrapRef.current
      const rect = placedRef.current
      if (!wrap || !rect.w) return

      const box = wrap.getBoundingClientRect()
      const cx = e.clientX - box.left
      const cy = e.clientY - box.top
      const u = (cx - rect.x) / rect.w
      const v = (cy - rect.y) / rect.h

      const view = viewRef.current
      const zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, view.zoom * Math.exp(-e.deltaY * 0.0012)))
      const w = (rect.w / view.zoom) * zoom
      const h = (rect.h / view.zoom) * zoom

      view.zoom = zoom
      view.x = cx - u * w - (box.width - w) / 2
      view.y = cy - v * h - (box.height - h) / 2

      setZoomed(Math.abs(zoom - 1) > 0.01)
      schedule()
    },
    [schedule],
  )

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    panRef.current = { x: e.clientX, y: e.clientY }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const pan = panRef.current
      if (!pan) return
      viewRef.current.x += e.clientX - pan.x
      viewRef.current.y += e.clientY - pan.y
      panRef.current = { x: e.clientX, y: e.clientY }
      setZoomed(true)
      schedule()
    },
    [schedule],
  )

  const onPointerUp = useCallback(() => {
    panRef.current = null
  }, [])

  return (
    <div
      ref={wrapRef}
      className={'stage' + (dragOver ? ' is-dragging' : '')}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={reset}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) onFile(file)
      }}
    >
      <canvas ref={canvasRef} />

      {zoomed && (
        <button type="button" className="fit" onClick={reset}>
          Ajustar
        </button>
      )}

      {dragOver && (
        <div className="drop">
          <span>Soltá tu foto de referencia acá</span>
        </div>
      )}
    </div>
  )
}
