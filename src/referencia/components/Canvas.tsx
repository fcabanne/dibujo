import { useCallback, useEffect, useRef, useState } from 'react'
import { copy } from '../../shared/copy'
import { aspectOf, type Reference } from '../../shared/referenceImage'
import { createEffects, type EffectsRenderer } from '../render/effects'
import { fitRect, paintScene } from '../render/scene'
import type { AppState } from '../types'

interface Props {
  reference: Reference | null
  state: AppState
  onFile: (file: File) => void
  /** Pantalla angosta: arriba flota una barra y la foto no puede meterse debajo. */
  compact: boolean
  /** Se avisa una vez si la máquina no puede correr los efectos. */
  onEffectsSupport: (supported: boolean) => void
}

const ZOOM = { min: 0.4, max: 8 }
/** Aire alrededor de la foto, para que la grilla no muera contra el borde de la ventana. */
const PAD = 32
/** Lo que hay que dejar libre arriba cuando la barra flotante está puesta. */
const TOP_BAR = 64

interface View {
  zoom: number
  x: number
  y: number
}

export function Canvas({ reference, state, onFile, onEffectsSupport, compact }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const effectsRef = useRef<EffectsRenderer | null>(null)
  const photoRef = useRef<CanvasImageSource | null>(null)
  const viewRef = useRef<View>({ zoom: 1, x: 0, y: 0 })
  /** Lo último que se dibujó, para poder anclar el zoom al puntero. */
  const placedRef = useRef({ x: 0, y: 0, w: 0, h: 0 })
  const frameRef = useRef(0)
  /** Los dedos apoyados. Uno mueve la foto; dos la acercan. */
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ spread: number; middle: { x: number; y: number } } | null>(null)

  const stateRef = useRef(state)
  const refRef = useRef(reference)
  const compactRef = useRef(compact)
  stateRef.current = state
  refRef.current = reference
  compactRef.current = compact

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
    // En pantalla angosta la barra de arriba flota sobre el lienzo, así que la foto
    // se encuadra en lo que queda por debajo y no en el alto completo.
    const top = compactRef.current ? TOP_BAR : PAD
    const availH = box.height - top - PAD
    const base = fitRect(aspect, { w: box.width - PAD * 2, h: availH })
    const w = base.w * view.zoom
    const h = base.h * view.zoom
    const rect = {
      x: (box.width - w) / 2 + view.x,
      y: top + (availH - h) / 2 + view.y,
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

  /**
   * Acercar dejando quieto el punto que se está mirando. Vale para la rueda y para
   * el pellizco: en los dos casos hay un lugar de la pantalla que no se tiene que
   * mover, el puntero o el medio de los dos dedos. Acercar hacia el centro de la
   * ventana en vez de hacia ahí obliga a reencuadrar después de cada gesto.
   */
  const zoomAt = useCallback((cx: number, cy: number, factor: number) => {
    const wrap = wrapRef.current
    const rect = placedRef.current
    if (!wrap || !rect.w) return

    const box = wrap.getBoundingClientRect()
    const u = (cx - rect.x) / rect.w
    const v = (cy - rect.y) / rect.h

    const view = viewRef.current
    const zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, view.zoom * factor))
    const w = (rect.w / view.zoom) * zoom
    const h = (rect.h / view.zoom) * zoom

    view.zoom = zoom
    view.x = cx - u * w - (box.width - w) / 2
    view.y = cy - v * h - (box.height - h) / 2

    setZoomed(Math.abs(zoom - 1) > 0.01)
  }, [])

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const box = wrapRef.current?.getBoundingClientRect()
      if (!box) return
      zoomAt(e.clientX - box.left, e.clientY - box.top, Math.exp(-e.deltaY * 0.0012))
      schedule()
    },
    [schedule, zoomAt],
  )

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    pinchRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // Un toque muy corto puede dejar de existir antes de que lleguemos a capturarlo.
      // Sin captura el gesto anda igual mientras el dedo no salga del lienzo.
    }
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const pointers = pointersRef.current
      const previous = pointers.get(e.pointerId)
      if (!previous) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      const box = wrapRef.current?.getBoundingClientRect()
      if (!box) return
      const view = viewRef.current

      if (pointers.size >= 2) {
        // Dos dedos: la distancia entre ellos manda el zoom y su punto medio el
        // desplazamiento. Se miden de nuevo en cada movimiento en vez de contra el
        // inicio del gesto, así levantar y volver a apoyar un dedo no pega un salto.
        const [a, b] = [...pointers.values()]
        const spread = Math.hypot(a.x - b.x, a.y - b.y)
        const middle = { x: (a.x + b.x) / 2 - box.left, y: (a.y + b.y) / 2 - box.top }
        const last = pinchRef.current

        if (last && last.spread > 0) {
          view.x += middle.x - last.middle.x
          view.y += middle.y - last.middle.y
          zoomAt(middle.x, middle.y, spread / last.spread)
        }
        pinchRef.current = { spread, middle }
      } else {
        view.x += e.clientX - previous.x
        view.y += e.clientY - previous.y
        setZoomed(true)
      }

      schedule()
    },
    [schedule, zoomAt],
  )

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId)
    // Que el dedo que queda no arrastre con el salto de haber sido parte del pellizco.
    pinchRef.current = null
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
          {copy.canvas.fit}
        </button>
      )}

      {dragOver && (
        <div className="drop">
          <span>{copy.canvas.drop}</span>
        </div>
      )}
    </div>
  )
}
